import {json} from '../../lib/security.js';
export async function onRequestGet({env}){if(!env.DB)return json({ok:false,db:false},503);try{await env.DB.prepare('SELECT 1').first();return json({ok:true,db:true});}catch{return json({ok:false,db:false},503);}}
