const encoder = new TextEncoder();
function b64url(bytes) {return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromB64url(input) { const raw=atob(input.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-input.length%4)%4)); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
export const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
async function signature(text,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(text))));}
export async function sign(value,secret){return `${value}.${await signature(value,secret)}`;}
export async function verify(value,secret){if(!value || !secret) return null;const dot=value.lastIndexOf('.'); if(dot<0) return null;const payload=value.slice(0,dot), sig=value.slice(dot+1);const expected=await signature(payload,secret); if(sig.length!==expected.length) return null;let different=0;for(let i=0;i<sig.length;i++)different |= sig.charCodeAt(i)^expected.charCodeAt(i); return different===0?payload:null;}
export function cookies(request){return Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)).filter(([k])=>k));}
export const cookie=(name,val,age=0)=>`${name}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function createSession(user,secret){const data={sub:String(user.id),name:String(user.username||'Estudante').slice(0,80),avatar:user.avatar||null,exp:Date.now()+1000*60*60*24*7};return sign(b64url(encoder.encode(JSON.stringify(data))),secret);}
export async function currentUser(ctx){const token=cookies(ctx.request).hc_session;const payload=await verify(token,ctx.env.SESSION_SECRET);if(!payload)return null;try{const data=JSON.parse(new TextDecoder().decode(fromB64url(payload)));if(data.exp<Date.now()||!/^\d{5,30}$/.test(data.sub))return null;return data;}catch{return null;}}
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export const unauthorized=()=>json({error:'Faça login com Discord para continuar.'},401);
export const ensureDb=(ctx)=>ctx.env.DB?null:json({error:'Banco D1 não configurado.'},503);
