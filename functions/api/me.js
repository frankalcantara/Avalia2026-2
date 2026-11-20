import {session,json} from '../_lib/auth.js';
export async function onRequestGet({request,env}){const user=await session(request,env);return user?json({user}):json({user:null},401)}
