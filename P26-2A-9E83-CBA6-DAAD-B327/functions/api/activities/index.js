import {currentUser,json,unauthorized,ensureDb} from '../../../lib/security.js';
import {validateActivity,LIMITS,totals,TOTAL_TARGET} from '../../../lib/core.js';
export async function onRequestGet(ctx){
 const user=await currentUser(ctx);if(!user)return unauthorized();const missing=ensureDb(ctx);if(missing)return missing;
 try{const {results}=await ctx.env.DB.prepare('SELECT id, title, category, hours, hours AS validated_hours, certificate_url, activity_date, description, created_at FROM activities WHERE user_id = ? ORDER BY activity_date DESC, id DESC').bind(user.sub).all();return json({activities:results,totals:totals(results),target:TOTAL_TARGET,limits:LIMITS});}
 catch{return json({error:'Erro ao consultar atividades. Banco inicializado? '},500);}
}
export async function onRequestPost(ctx){
 const user=await currentUser(ctx);if(!user)return unauthorized();const missing=ensureDb(ctx);if(missing)return missing;
 let raw;try{raw=await ctx.request.json();}catch{return json({error:'JSON inválido.'},400);}
 const error=validateActivity(raw);if(error)return json({error},400);
 const title=raw.title.trim(),category=raw.category,hours=raw.hours,url=raw.certificate_url.trim(),date=raw.activity_date,description=(raw.description||'').trim();
 try{
 // INSERT condicional atômico: não confiar nos totais enviados pelo navegador.
 const r=await ctx.env.DB.prepare(`INSERT INTO activities(user_id,title,category,hours,certificate_url,activity_date,description)
 SELECT ?,?,?,?,?,?,? WHERE COALESCE((SELECT SUM(hours) FROM activities WHERE user_id=? AND category=?),0)+? <= ?`).bind(user.sub,title,category,hours,url,date,description,user.sub,category,hours,LIMITS[category]).run();
 if(!r.meta?.changes)return json({error:`Limite de ${LIMITS[category]} horas em ${category} excedido.`},409);
 return json({ok:true,id:r.meta.last_row_id},201);
 }catch{return json({error:'Não foi possível salvar a atividade.'},500);}
}
