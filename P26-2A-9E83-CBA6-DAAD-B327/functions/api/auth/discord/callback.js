import {cookies,cookie,createSession} from '../../../../lib/security.js';
const fail=(reason)=>new Response(null,{status:302,headers:{Location:'/?erro='+encodeURIComponent(reason),'Set-Cookie':cookie('hc_state','',0)}});
export async function onRequestGet({request,env}){
 const u=new URL(request.url),code=u.searchParams.get('code'),state=u.searchParams.get('state');
 if(!code || !state || state!==cookies(request).hc_state || u.searchParams.get('error')) return fail('Autenticação cancelada ou inválida.');
 if(!env.DB || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET)return fail('Configuração incompleta.');
 const redirect=`${u.origin}/api/auth/discord/callback`;
 try {
  const form=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:redirect});
  const tokenResp=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',body:form,headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  if(!tokenResp.ok)return fail('Não foi possível validar autorização no Discord.');
  const token=await tokenResp.json();
  const userResp=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`}});
  if(!userResp.ok)return fail('Não foi possível obter o perfil.');
  const user=await userResp.json();
  if(!/^\d{5,30}$/.test(String(user.id)))return fail('Identidade inválida.');
  await env.DB.prepare('INSERT INTO users (discord_id, name, avatar, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(discord_id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar').bind(String(user.id),String(user.username||'Estudante').slice(0,80),user.avatar||null).run();
  const session=await createSession(user,env.SESSION_SECRET);
  const headers=new Headers({Location:'/', 'Cache-Control':'no-store'});
  headers.append('Set-Cookie',cookie('hc_state','',0));headers.append('Set-Cookie',cookie('hc_session',session,604800));
  return new Response(null,{status:302,headers});
 }catch{return fail('Falha no login. Verifique o banco ou tente novamente.');}
}
