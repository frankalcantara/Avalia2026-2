import {currentUser,json,unauthorized} from '../../lib/security.js';
export async function onRequestGet(ctx){const user=await currentUser(ctx);return user?json({user:{id:user.sub,name:user.name,avatar:user.avatar}}):unauthorized();}
