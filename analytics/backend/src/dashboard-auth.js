const COOKIE='__Host-jb_analytics';
const LIFETIME=86400;
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function decode(text){return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function key(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export function tokenMatches(got,expected){if(typeof expected!=='string'||expected.length<32||got.length!==expected.length)return false;let diff=0;for(let i=0;i<got.length;i++)diff|=got.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}
export async function sessionCookie(secret,now=Date.now()){
 const nonce=encode(crypto.getRandomValues(new Uint8Array(16)));
 const payload=`v1.${Math.floor(now/1000)+LIFETIME}.${nonce}`;
 const signature=encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(payload))));
 return `${COOKIE}=${payload}.${signature}; Path=/; Max-Age=${LIFETIME}; Secure; HttpOnly; SameSite=Lax`;
}
export function clearSessionCookie(){return `${COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;}
export async function sessionAllowed(request,secret,now=Date.now()){
 if(typeof secret!=='string'||secret.length<32)return false;
 const value=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
 if(!/^v1\.\d{10}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(value))return false;
 const [version,expiry,nonce,sig]=value.split('.'),seconds=Math.floor(now/1000);
 if(Number(expiry)<=seconds||Number(expiry)>seconds+LIFETIME)return false;
 try{return await crypto.subtle.verify('HMAC',await key(secret),decode(sig),new TextEncoder().encode(`${version}.${expiry}.${nonce}`));}catch{return false;}
}
export async function adminAllowed(request,env){
 const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 return tokenMatches(bearer,env.ADMIN_TOKEN)||await sessionAllowed(request,env.ADMIN_TOKEN);
}
export function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin;}
