const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
async function key(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function sign(value,secret){const data=b64(enc.encode(JSON.stringify(value)));const sig=await crypto.subtle.sign('HMAC',await key(secret),enc.encode(data));return `${data}.${b64(sig)}`;}
export async function verify(value,secret){try{const [data,sig]=value.split('.');if(!data||!sig)return null;const ok=await crypto.subtle.verify('HMAC',await key(secret),unb64(sig),enc.encode(data));if(!ok)return null;const payload=JSON.parse(new TextDecoder().decode(unb64(data)));if(payload.exp<Date.now())return null;return payload;}catch{return null;}}
export function cookie(request,name){const item=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return item?decodeURIComponent(item.slice(name.length+1)):null;}
export function setCookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;}
export function clearCookie(name){return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`}
export async function session(request,env){const token=cookie(request,'tb_session');if(!token)return null;const payload=await verify(token,env.SESSION_SECRET);return payload?.user||null;}
export function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}})}
export async function requireUser(request,env){const user=await session(request,env);return user||null;}
export function bad(message,status=400){return json({error:message},status)}
export async function body(request){try{return await request.json()}catch{return null}}
export const id=()=>crypto.randomUUID();
