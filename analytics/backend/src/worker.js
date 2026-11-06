/**
 * Jonas Analytics API - Cloudflare Worker + D1
 * Opt-in analytics for jonasbader7.github.io.
 *
 * Raw IP addresses are available only through authenticated /admin/security,
 * never in the public analytics tables or API. Deploy only after adding a
 * privacy notice, choosing retention times and confirming legal requirements.
 *
 * Required bindings: DB (D1); Secrets: ADMIN_TOKEN, HASH_SECRET.
 * Optional: ALLOWED_ORIGINS env var, comma-separated exact origins.
 */
const DEFAULT_ORIGINS = ["https://jonasbader7.github.io"];
const JSON_HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const VALID_SITES = ["portfolio","bors"];
const VALID_EVENTS = ["pageview","link_click","feature_click","engagement"];
const MAX_BODY = 2048;

function respond(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {status, headers: {...JSON_HEADERS,...headers}});
}
function origins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(",")).split(",").map(s=>s.trim()).filter(Boolean);
}
function cors(request, env) {
  const origin=request.headers.get("Origin") || "";
  if (!origin || !origins(env).includes(origin)) return null;
  return {"Access-Control-Allow-Origin":origin, "Vary":"Origin",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Max-Age":"86400"};
}
function clean(s, max=120) {return typeof s==="string"?s.slice(0,max):"";}
function enumerated(v, arr) {return arr.includes(v)?v:"";}

async function hashSession(id, secret, date) {
  const te=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",te.encode(secret),"HMAC",false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",key,te.encode(date+"|"+id));
  return Array.from(new Uint8Array(signature)).map(n=>n.toString(16).padStart(2,"0")).join("");
}
function secureCompare(actual, expected) {
  if (!actual || !expected) return false;
  const a=new TextEncoder().encode(actual), b=new TextEncoder().encode(expected);
  if (a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff|=a[i]^b[i];
  return diff===0;
}
function requireAdmin(request,env) {
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
  return Boolean(env.ADMIN_TOKEN && env.ADMIN_TOKEN.length>=32 && secureCompare(token,env.ADMIN_TOKEN));
}
function validPath(raw) {
  if(!/^\/(Portfoliopage|BORS)\/[a-zA-Z0-9/_-]{0,110}$/.test(raw)) return "";
  return raw;
}
function ipOf(request) {
  // Only trust the Cloudflare-provided connecting-IP header at the edge.
  return clean(request.headers.get("CF-Connecting-IP") || "", 48);
}
function placeOf(request) {
  const cf=request.cf || {};
  return {
    country:clean(cf.country||"ZZ",2),
    region:clean(cf.regionCode||cf.region||"",55),
    city:clean(cf.city||"",80)
  };
}

async function collect(request,env) {
  const c=cors(request,env);
  if(!c) return respond({error:"Origin not allowed"},403);
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:c});
  if(request.method!=="POST") return respond({error:"Method not allowed"},405,c);
  if(Number(request.headers.get("Content-Length")||0)>MAX_BODY) return respond({error:"Too large"},413,c);
  let input;
  try {const raw=await request.text(); if(raw.length>MAX_BODY) return respond({error:"Too large"},413,c);input=JSON.parse(raw);}
  catch(_) {return respond({error:"Invalid body"},400,c);}
  const site=enumerated(input.site,VALID_SITES), event=enumerated(input.event,VALID_EVENTS);
  if(!site||!event) return respond({error:"Invalid event"},400,c);
  const path=validPath(clean(input.path));
  if(!path || (site==="bors")!==(path.startsWith("/BORS/"))) return respond({error:"Invalid path"},400,c);
  const session=clean(input.session,42);
  if(!/^[0-9a-f]{32}$/i.test(session)) return respond({error:"Invalid session"},400,c);
  const detail=clean(input.detail,70);
  if(event==="link_click" && !/^(github(?::[A-Za-z0-9_-]{1,40})?|contact|bors-demo|strava|internal|external|other)$/.test(detail))return respond({error:"Invalid detail"},400,c);
  if(event==="feature_click" && !/^(tab|view|demo):[a-z0-9_-]{1,35}$/.test(detail)) return respond({error:"Invalid detail"},400,c);
  if(event==="pageview"||event==="engagement") {if(detail) return respond({error:"Invalid detail"},400,c);}
  const origin=request.headers.get("Origin") || "";
  if(origin!=="https://jonasbader7.github.io")return respond({error:"Unexpected origin"},403,c);
  // Browser-provided device labels are approximate and not trusted for security.
  const device=enumerated(input.device,["mobile","tablet","desktop"]);
  const browser=enumerated(input.browser,["Edge","Firefox","Chrome","Safari","Other"]);
  const source=enumerated(input.source,["instagram","linkedin","github","strava"]);
  const referrer=clean(input.referrer,100).replace(/[^a-zA-Z0-9.:-]/g,"");
  const duration=event==="engagement" ? Math.min(1800,Math.max(0,Number(input.duration)||0)) : 0;
  const now=new Date(), date=now.toISOString().slice(0,10);
  if(!env.HASH_SECRET || env.HASH_SECRET.length<32)return respond({error:"Backend configuration incomplete"},503,c);
  const hashed=await hashSession(session,env.HASH_SECRET,date);
  const place=placeOf(request),ip=ipOf(request);
  const time=now.toISOString();
  // Separate retention: 180-day pseudonymous event records, 14-day IP security logs.
  // Do not store full IP in analytics_events or session identifiers in security_access.
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO analytics_events(ts,site,event,path,detail,session_hash,source,referrer,device,browser,duration,country,region,city) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(time,site,event,path,detail,hashed,source,referrer,device,browser,Math.round(duration),place.country,place.region,place.city),
      env.DB.prepare("INSERT INTO security_access(ts,site,ip,country,region,city,event,endpoint) VALUES(?,?,?,?,?,?,?,?)")
        .bind(time,site,ip,place.country,place.region,place.city,event,path)
    ]);
  }catch(_){
    // Don't return internal exceptions / sensitive DB details.
    return respond({error:"Storage temporarily unavailable"},503,c);
  }
  return new Response(null,{status:204,headers:c});
}

async function admin(request,env,url) {
  if(!requireAdmin(request,env))return respond({error:"Unauthorized"},401,{"WWW-Authenticate":"Bearer"});
  if(request.method!=="GET")return respond({error:"Method not allowed"},405);
  const limit=Math.min(100,Math.max(1,parseInt(url.searchParams.get("limit")||"50",10)||50));
  const days=Math.min(180,Math.max(1,parseInt(url.searchParams.get("days")||"30",10)||30));
  const from=new Date(Date.now()-days*86400000).toISOString();
  if(url.pathname==="/admin/summary"){
    const [totals,countries,regions,devices,pages,events,sources,daily] = await Promise.all([
      env.DB.prepare("SELECT site,COUNT(*) AS events,COUNT(DISTINCT session_hash) AS approximate_sessions, SUM(CASE WHEN event='pageview' THEN 1 ELSE 0 END) AS pageviews, SUM(CASE WHEN event='engagement' THEN duration ELSE 0 END) AS seconds_on_page FROM analytics_events WHERE ts>=? GROUP BY site").bind(from).all(),
      env.DB.prepare("SELECT country,COUNT(*) AS events,COUNT(DISTINCT session_hash) AS approximate_sessions FROM analytics_events WHERE ts>=? AND event='pageview' GROUP BY country ORDER BY events DESC LIMIT 50").bind(from).all(),
      env.DB.prepare("SELECT country,region,city,COUNT(*) AS pageviews FROM analytics_events WHERE ts>=? AND event='pageview' GROUP BY country,region,city ORDER BY pageviews DESC LIMIT 100").bind(from).all(),
      env.DB.prepare("SELECT device,browser,COUNT(*) AS pageviews FROM analytics_events WHERE ts>=? AND event='pageview' GROUP BY device,browser ORDER BY pageviews DESC").bind(from).all(),
      env.DB.prepare("SELECT site,path,COUNT(*) AS pageviews FROM analytics_events WHERE ts>=? AND event='pageview' GROUP BY site,path ORDER BY pageviews DESC LIMIT 100").bind(from).all(),
      env.DB.prepare("SELECT site,event,detail,COUNT(*) AS count FROM analytics_events WHERE ts>=? AND event IN ('link_click','feature_click') GROUP BY site,event,detail ORDER BY count DESC LIMIT 100").bind(from).all(),
      env.DB.prepare("SELECT source,referrer,COUNT(*) AS pageviews FROM analytics_events WHERE ts>=? AND event='pageview' GROUP BY source,referrer ORDER BY pageviews DESC LIMIT 40").bind(from).all(),
      env.DB.prepare("SELECT substr(ts,1,10) AS date,site,COUNT(*) AS events,SUM(CASE WHEN event='pageview' THEN 1 ELSE 0 END) AS pageviews FROM analytics_events WHERE ts>=? GROUP BY date,site ORDER BY date DESC LIMIT 365").bind(from).all()
    ]);
    return respond({days,notice:"Session counts are approximate and are not a count of people (IDs rotate daily). Engagement excludes background time.",totals:totals.results,countries:countries.results,regions:regions.results,devices:devices.results,pages:pages.results,events:events.results,sources:sources.results,daily:daily.results});
  }
  if(url.pathname==="/admin/security"){
    const res=await env.DB.prepare("SELECT ts,site,ip,country,region,city,event,endpoint FROM security_access ORDER BY ts DESC LIMIT ?").bind(limit).all();
    return respond({entries:res.results,retention_days:14,warning:"Confidential personal data. Do not publish, share or correlate with identified people."});
  }
  return respond({error:"Not found"},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==="/collect")return collect(request,env);
    if(url.pathname.startsWith("/admin/"))return admin(request,env,url);
    if(url.pathname==="/health" && request.method==="GET")return respond({ok:true,collecting:"requires explicit visitor consent"});
    return respond({error:"Not found"},404);
  },
  async scheduled(controller,env,ctx){
    // Retention enforced every day; cron must be enabled via wrangler.jsonc.
    ctx.waitUntil(env.DB.batch([
      env.DB.prepare("DELETE FROM security_access WHERE ts < ?").bind(new Date(Date.now()-14*86400000).toISOString()),
      env.DB.prepare("DELETE FROM analytics_events WHERE ts < ?").bind(new Date(Date.now()-180*86400000).toISOString())
    ]));
  }
};
