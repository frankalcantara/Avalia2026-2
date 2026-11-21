import {currentUser,json,unauthorized,ensureDb} from '../../../lib/security.js';
export async function onRequestDelete(ctx){
 const user=await currentUser(ctx);if(!user)return unauthorized();const missing=ensureDb(ctx);if(missing)return missing;
 const id=Number(ctx.params.id);if(!Number.isSafeInteger(id)||id<1)return json({error:'ID inválido.'},400);
 try{const result=await ctx.env.DB.prepare('DELETE FROM activities WHERE id=? AND user_id=?').bind(id,user.sub).run();return result.meta?.changes?json({ok:true}):json({error:'Atividade não encontrada.'},404);}
 catch{return json({error:'Erro ao excluir atividade.'},500);}
}
