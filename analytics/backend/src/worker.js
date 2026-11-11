import {adminAllowed} from "./dashboard-auth.js";
import {dashboardRoute} from "./dashboard-routes.js";
import {summary} from "./reporting.js";
/** Cloudflare Worker + D1: anonymous hourly counters + separated security logs.
 * No cookies, stable IDs, fingerprinting, URL parameters, submitted text or route coordinates.
 * Full IP addresses appear ONLY in protected security logs (90-day retention) (pageview requests).
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

async function collect(request,env) {
  let c=cors(request);
  if(!c)return result({error:"Origin forbidden"},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:c});
  if(request.method!=="POST")return result({error:"Method not allowed"},405,c);
  let raw;
  try {raw=await request.text();if(raw.length>1500)return result({error:"Too long"},413,c);}
  catch(_) {return result({error:"Unreadable request"},400,c);}
  let v;try {v=JSON.parse(raw);} catch(_) {return result({error:"Invalid JSON"},400,c);}
  if(!v || typeof v !== "object" || Array.isArray(v))return result({error:"Invalid event"},400,c);
  let site=one(v.site,["portfolio","bors","greenroute","transparenz"]);
  let event=one(v.event,["pageview","link_click","feature_click","engagement"]);
  if(!site||!event)return result({error:"Invalid event"},400,c);
  if(site === "greenroute") site = "bors"; // Historical storage key retained.
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
  if(!await adminAllowed(request,env))return result({error:"Not authorized"},401);
  if(request.method!=="GET")return result({error:"Method not allowed"},405);
  if(url.pathname==="/admin/ip") return result({ip:ipAddress(request)});
  let days=Math.min(180,Math.max(1,parseInt(url.searchParams.get("days")||"30",10)||30));
  let since=new Date(Date.now()-days*86400000).toISOString().slice(0,13)+":00:00Z";
  if(url.pathname==="/admin/summary") {
    const selected=url.searchParams.get("site")||"all";
    if(!["all","portfolio","greenroute","transparenz"].includes(selected))return result({error:"Invalid site"},400);
    return result(await summary(env.DB,days,selected));
  }
  if(url.pathname==="/admin/security") {
    let limit=Math.min(1000,Math.max(1,parseInt(url.searchParams.get("limit")||"1000",10)||1000));
    let excluded=[...new Set(url.searchParams.getAll("excludeIP"))];
    if(excluded.length>20 || excluded.some(ip=>ip.length>48 || !/^[0-9a-fA-F:.]+$/.test(ip)))return result({error:"Invalid excluded IP"},400);
    let filter=excluded.length ? ` AND ip NOT IN (${excluded.map(()=>"?").join(",")})` : "";
    let rows=await env.DB.prepare(`SELECT ts,site,ip,country,region,city,reason FROM security_access WHERE ts>=?${filter} ORDER BY ts DESC,id DESC LIMIT ?`).bind(since,...excluded,limit).all();
    return result({entries:rows.results,retentionDays:90,warning:"Confidential IP logs. Only for security diagnostics; no visitor profiling."});
  }
  return result({error:"Not found"},404);
}
export default {
  async fetch(request,env) {
    let url=new URL(request.url);
    if(url.pathname==="/dashboard"||url.pathname.startsWith("/dashboard/"))return dashboardRoute(request,env,url);
    if(url.pathname==="/collect")return collect(request,env);
    if(url.pathname.startsWith("/admin/"))return admin(request,env,url);
    if(url.pathname==="/health"&&request.method==="GET")return result({ok:true});
    return result({error:"Not found"},404);
  },
  async scheduled(_controller,env,ctx) {
    let cutoffSecurity=new Date(Date.now()-90*86400000).toISOString();
    let cutoffAnalytics=new Date(Date.now()-180*86400000).toISOString();
    ctx.waitUntil(env.DB.batch([
      env.DB.prepare("DELETE FROM security_access WHERE ts < ?").bind(cutoffSecurity),
      env.DB.prepare("DELETE FROM analytics_hourly WHERE hour < ?").bind(cutoffAnalytics)
    ]));
  }
};

