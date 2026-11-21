import {random,cookie} from '../../../lib/security.js';
export async function onRequestGet({request,env}){
 if(!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET)return new Response('Configure DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e SESSION_SECRET.',{status:503});
 const state=random();const origin=new URL(request.url).origin;const redirect=`${origin}/api/auth/discord/callback`;
 const u=new URL('https://discord.com/oauth2/authorize');u.searchParams.set('response_type','code');u.searchParams.set('client_id',env.DISCORD_CLIENT_ID);u.searchParams.set('scope','identify');u.searchParams.set('redirect_uri',redirect);u.searchParams.set('state',state);
 return new Response(null,{status:302,headers:{Location:u.toString(),'Set-Cookie':cookie('hc_state',state,600),'Cache-Control':'no-store'}});
}
