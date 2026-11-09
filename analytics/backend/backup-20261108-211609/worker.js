/** Cloudflare Worker + D1: anonymous hourly counters + separated security logs.
 * No cookies, stable IDs, fingerprinting, URL parameters, submitted text or route coordinates.
 * Full IP addresses appear ONLY in protected short-lived security logs (pageview requests).
 * IMPORTANT: Do not deploy without displaying the privacy statement and verifying local legal requirements.
 *
 * Bindings: DB (D1); secrets: ADMIN_TOKEN (random >=32 chars), ALLOWED_ORIGIN optional.
 * Set ADMIN_TOKEN with wrangler secret put ADMIN_TOKEN; never commit it.
 */
const ORIGIN = "https://jonasbader7.github.io";
const HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
function result(data,status=200,headers={}) {
  return new Response(JSON.stringify(data), {status,headers:{...HEADERS,...headers}});
}
function cors(request) {
  if (request.headers.get("Origin") !== ORIGIN) return null;
  return {"Access-Control-Allow-Origin":ORIGIN,"Vary":"Origin","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400"};
}
function one(v,values) {return typeof v==="string" && values.includes(v)?v:"";}
function short(v,n) {return typeof v==="string"?v.slice(0,n):"";}
function ipAddress(request) {return short(request.headers.get("CF-Connecting-IP")||"",48);}
function geo(request) {
  let cf = request.cf||{};
  return {
    country:short(cf.country||"ZZ",2),
    region:short(cf.regionCode||cf.region||"",60),
    city:short(cf.city||"",80)
  };
}
function adminAllowed(request,env) {
  let got=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
  let expected=env.ADMIN_TOKEN||"";
  if (expected.length<32 || got.length!==expected.length) return false;
  let d=0;
  for(let i=0;i<got.length;i++)d|=got.charCodeAt(i)^expected.charCodeAt(i);
  return d===0;
}
async function collect(request,env) {
  let c=cors(request);
  if(!c)return result({error:"Origin forbidden"},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:c});
  if(request.method!=="POST")return result({error:"Method not allowed"},405,c);
  let raw;
  try {raw=await request.text();if(raw.length>1500)return result({error:"Too long"},413,c);}
  catch(_) {return result({error:"Unreadable request"},400,c);}
  let v;try {v=JSON.parse(raw);} catch(_) {return result({error:"Invalid JSON"},400,c);}
  let site=one(v.site,["portfolio","bors","transparenz"]);
  let event=one(v.event,["pageview","link_click","feature_click","engagement"]);
  if(!site||!event)return result({error:"Invalid event"},400,c);
  let detail=short(v.detail,70);
  if(event==="link_click" && !/^(contact|github(?::[A-Za-z0-9_-]{1,40})?|bors-demo|strava|internal|external)$/.test(detail))return result({error:"Invalid detail"},400,c);
  if(event==="feature_click" && !/^(tab|view|demo):[a-z0-9_-]{1,35}$/.test(detail))return result({error:"Invalid detail"},400,c);
  if((event==="pageview"||event==="engagement") && detail)return result({error:"Unexpected detail"},400,c);
  let source=one(v.source,["instagram","github","linkedin","strava"]);
  let device=one(v.device,["mobile","tablet","desktop"]);
  let browser=one(v.browser,["Edge","Firefox","Chrome","Safari","Other"]);
  let duration=event==="engagement"?Math.min(1800,Math.max(0,Math.round(Number(v.duration)||0))):0;
  let now=new Date().toISOString(), hour=now.slice(0,13)+":00:00Z";
  let loc=geo(request);
  // Group by hour, site, event, non-identifying labels and approximate location.
  // The grouped counters never include a visitor ID or IP address.
  try {
    await env.DB.prepare("INSERT INTO analytics_hourly(hour,site,event,detail,source,device,browser,country,region,city,hits,duration_seconds) VALUES(?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(hour,site,event,detail,source,device,browser,country,region,city) DO UPDATE SET hits=hits+1,duration_seconds=duration_seconds+excluded.duration_seconds")
      .bind(hour,site,event,detail,source,device,browser,loc.country,loc.region,loc.city,duration).run();
    // Security log: only the first page-load request, never click actions.
    if (event==="pageview") {
      await env.DB.prepare("INSERT INTO security_access(ts,site,ip,country,region,city,reason) VALUES(?,?,?,?,?,?,?)")
        .bind(now,site,ipAddress(request),loc.country,loc.region,loc.city,"page-request").run();
    }
  } catch(_) {return result({error:"Service unavailable"},503,c);}
  return new Response(null,{status:204,headers:c});
}
async function admin(request,env,url) {
  if(!adminAllowed(request,env))return result({error:"Not authorized"},401);
  if(request.method!=="GET")return result({error:"Method not allowed"},405);
  let days=Math.min(180,Math.max(1,parseInt(url.searchParams.get("days")||"30",10)||30));
  let since=new Date(Date.now()-days*86400000).toISOString().slice(0,13)+":00:00Z";
  if(url.pathname==="/admin/summary") {
    let queries=[
      ["totals","SELECT site,event,SUM(hits) hits,SUM(duration_seconds) seconds FROM analytics_hourly WHERE hour>=? GROUP BY site,event"],
      ["countries","SELECT country,SUM(hits) hits FROM analytics_hourly WHERE hour>=? AND event='pageview' GROUP BY country ORDER BY hits DESC LIMIT 100"],
      ["regions","SELECT country,region,city,SUM(hits) hits FROM analytics_hourly WHERE hour>=? AND event='pageview' GROUP BY country,region,city ORDER BY hits DESC LIMIT 100"],
      ["devices","SELECT device,browser,SUM(hits) hits FROM analytics_hourly WHERE hour>=? AND event='pageview' GROUP BY device,browser ORDER BY hits DESC"],
      ["clicks","SELECT site,event,detail,SUM(hits) hits FROM analytics_hourly WHERE hour>=? AND event IN ('link_click','feature_click') GROUP BY site,event,detail ORDER BY hits DESC LIMIT 100"],
      ["sources","SELECT source,SUM(hits) hits FROM analytics_hourly WHERE hour>=? AND event='pageview' GROUP BY source ORDER BY hits DESC"],
      ["daily","SELECT substr(hour,1,10) day,site,event,SUM(hits) hits FROM analytics_hourly WHERE hour>=? GROUP BY day,site,event ORDER BY day DESC LIMIT 540"]
    ];
    let output={days,note:"Counts are requests, not unique people. Duration is approximate foreground time."};
    for(let [name,query] of queries)output[name]=(await env.DB.prepare(query).bind(since).all()).results;
    return result(output);
  }
  if(url.pathname==="/admin/security") {
    let limit=Math.min(100,Math.max(1,parseInt(url.searchParams.get("limit")||"50",10)||50));
    let rows=await env.DB.prepare("SELECT ts,site,ip,country,region,city,reason FROM security_access ORDER BY ts DESC LIMIT ?").bind(limit).all();
    return result({entries:rows.results,retentionDays:14,warning:"Confidential IP logs. Only for security diagnostics; no visitor profiling."});
  }
  return result({error:"Not found"},404);
}
export default {
  async fetch(request,env) {
    let url=new URL(request.url);
    if(url.pathname==="/collect")return collect(request,env);
    if(url.pathname.startsWith("/admin/"))return admin(request,env,url);
    if(url.pathname==="/health"&&request.method==="GET")return result({ok:true});
    return result({error:"Not found"},404);
  },
  async scheduled(_controller,env,ctx) {
    let cutoffSecurity=new Date(Date.now()-14*86400000).toISOString();
    let cutoffAnalytics=new Date(Date.now()-180*86400000).toISOString();
    ctx.waitUntil(env.DB.batch([
      env.DB.prepare("DELETE FROM security_access WHERE ts < ?").bind(cutoffSecurity),
      env.DB.prepare("DELETE FROM analytics_hourly WHERE hour < ?").bind(cutoffAnalytics)
    ]));
  }
};
