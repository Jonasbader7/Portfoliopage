import dashboardHTML from './dashboard-shell.js';
import {sessionAllowed,sessionCookie,clearSessionCookie,tokenMatches,sameOrigin} from './dashboard-auth.js';
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const login=(message='')=>`<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jonas Analytics · Anmelden</title><style>body{font:16px/1.6 system-ui;background:#f3f5f4;color:#182c27;max-width:460px;margin:10vh auto;padding:24px}form{background:white;padding:28px;border:1px solid #dce5e0;border-radius:16px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;margin:8px 0 16px;border:1px solid #b9cdc2;border-radius:8px}button{background:#166a54;color:white;cursor:pointer}p{color:#52675b}</style></head><body><h1>Deine Website-Statistik</h1><p>Aktuelle Zahlen automatisch laden, nach Website filtern und alle 60 Sekunden aktualisieren.</p><form method="post" action="/dashboard/login"><label for="token">Bestehender Analytics-Admin-Token</label><input id="token" name="token" type="password" autocomplete="current-password" required minlength="32" maxlength="256"><button>Anmelden</button><p role="status">${message}</p><small>Die Anmeldung gilt für 24 Stunden in diesem Browser. Der Token wird weder im Dashboard-Code noch im Browser-Speicher abgelegt.</small></form></body></html>`;
export async function dashboardRoute(request,env,url){
 if(url.pathname==='/dashboard/status'&&request.method==='GET')return new Response(JSON.stringify({dashboard:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://jonasbader7.github.io','Vary':'Origin'}});
 if(url.pathname==='/dashboard/login'&&request.method==='POST'){
  if(!sameOrigin(request))return new Response('Origin forbidden',{status:403,headers});
  if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32)return new Response(login('Admin-Zugang ist auf dem Server noch nicht eingerichtet.'),{status:503,headers});
  const raw=await request.text();if(raw.length>2048)return new Response('Request too large',{status:413,headers});
  const token=new URLSearchParams(raw).get('token')||'';
  if(!tokenMatches(token,env.ADMIN_TOKEN))return new Response(login('Anmeldung fehlgeschlagen.'),{status:401,headers});
  return new Response(null,{status:303,headers:{...headers,Location:'/dashboard','Set-Cookie':await sessionCookie(env.ADMIN_TOKEN)}});
 }
 if(url.pathname==='/dashboard/logout'&&request.method==='POST'){
  if(!sameOrigin(request))return new Response('Origin forbidden',{status:403,headers});
  return new Response(null,{status:303,headers:{...headers,Location:'/dashboard','Set-Cookie':clearSessionCookie()}});
 }
 if(url.pathname==='/dashboard'&&request.method==='GET')return new Response(await sessionAllowed(request,env.ADMIN_TOKEN)?dashboardHTML:login(),{headers});
 return new Response('Not found',{status:404,headers});
}
