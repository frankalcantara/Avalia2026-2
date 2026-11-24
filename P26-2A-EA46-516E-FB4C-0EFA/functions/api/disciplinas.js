import { lerSessao } from "../_lib/sessao.js";

const TIPOS = ["prova", "trabalho", "lista"];
const MAX_CORPO = 100000;
const json = (obj, status = 200) => Response.json(obj, { status, headers: { "Cache-Control": "no-store" } });
const ehNumero = (v) => typeof v === "number" && Number.isFinite(v);

function origemInvalida(request, env) {
  const o = request.headers.get("Origin");
  if (o === null) return false;
  const permitidas = [new URL(request.url).origin];
  if (env.DISCORD_REDIRECT_URI) {
    try { permitidas.push(new URL(env.DISCORD_REDIRECT_URI).origin); } catch {}
  }
  return !permitidas.includes(o);
}

function validar(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return "Corpo da requisição inválido";
  if (typeof b.nome !== "string") return "Nome da disciplina inválido";
  const nome = b.nome.trim();
  if (nome.length < 1 || nome.length > 80) return "Nome da disciplina: 1 a 80 caracteres";
  if (!ehNumero(b.media_aprovacao) || !(b.media_aprovacao > 0 && b.media_aprovacao <= 10))
    return "Média de aprovação deve estar entre 0 e 10";
  if (!ehNumero(b.media_exame) || !(b.media_exame >= 0 && b.media_exame < b.media_aprovacao))
    return "Média de exame deve ser menor que a de aprovação";
  if (!Array.isArray(b.avaliacoes) || b.avaliacoes.length < 1 || b.avaliacoes.length > 30)
    return "Informe de 1 a 30 avaliações";
  for (const a of b.avaliacoes) {
    if (!a || typeof a !== "object") return "Avaliação inválida";
    if (typeof a.nome !== "string" || a.nome.trim().length < 1 || a.nome.length > 60) return "Nome da avaliação inválido";
    if (!TIPOS.includes(a.tipo)) return "Tipo de avaliação inválido";
    if (!ehNumero(a.peso) || !(a.peso > 0 && a.peso <= 100)) return "O peso deve estar entre 0 e 100";
    if (a.nota !== null && a.nota !== undefined) {
      if (!ehNumero(a.nota) || !(a.nota >= 0 && a.nota <= 10)) return "A nota deve estar entre 0 e 10";
    }
  }
  return null;
}

async function lerJson(request) {
  const txt = await request.text();
  if (txt.length > MAX_CORPO) return { grande: true };
  try { return { body: JSON.parse(txt) }; } catch { return { body: null }; }
}

function stmtsAvaliacoes(env, disciplinaId, avaliacoes) {
  return avaliacoes.map((a) =>
    env.DB.prepare("INSERT INTO avaliacoes (disciplina_id, nome, tipo, peso, nota) VALUES (?, ?, ?, ?, ?)")
      .bind(disciplinaId, a.nome.trim(), a.tipo, a.peso, a.nota === undefined ? null : a.nota)
  );
}

async function ehDono(env, id, userId) {
  return await env.DB.prepare("SELECT id FROM disciplinas WHERE id = ? AND user_id = ?").bind(id, userId).first();
}

const idDaUrl = (request) => {
  const id = Number(new URL(request.url).searchParams.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function onRequestGet({ request, env }) {
  const u = await lerSessao(request, env);
  if (!u) return json({ erro: "Não autenticado" }, 401);
  const { results: ds } = await env.DB.prepare("SELECT id, nome, media_aprovacao, media_exame FROM disciplinas WHERE user_id = ? ORDER BY id").bind(u.userId).all();
  for (const d of ds) {
    const { results } = await env.DB.prepare("SELECT id, nome, tipo, peso, nota FROM avaliacoes WHERE disciplina_id = ? ORDER BY id").bind(d.id).all();
    d.avaliacoes = results;
  }
  return json(ds);
}

export async function onRequestPost({ request, env }) {
  if (origemInvalida(request, env)) return json({ erro: "Origem não permitida" }, 403);
  const u = await lerSessao(request, env);
  if (!u) return json({ erro: "Não autenticado" }, 401);
  const lido = await lerJson(request);
  if (lido.grande) return json({ erro: "Corpo da requisição muito grande" }, 413);
  const body = lido.body;
  const msg = validar(body);
  if (msg) return json({ erro: msg }, 400);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM disciplinas WHERE user_id = ?").bind(u.userId).first();
  if (n >= 20) return json({ erro: "Limite de 20 disciplinas" }, 400);
  const r = await env.DB.prepare("INSERT INTO disciplinas (user_id, nome, media_aprovacao, media_exame) VALUES (?, ?, ?, ?)")
    .bind(u.userId, body.nome.trim(), body.media_aprovacao, body.media_exame).run();
  const id = r.meta.last_row_id;
  try {
    await env.DB.batch(stmtsAvaliacoes(env, id, body.avaliacoes));
  } catch {
    await env.DB.prepare("DELETE FROM disciplinas WHERE id = ? AND user_id = ?").bind(id, u.userId).run();
    return json({ erro: "Falha ao salvar as avaliações" }, 500);
  }
  return json({ id }, 201);
}

export async function onRequestPut({ request, env }) {
  if (origemInvalida(request, env)) return json({ erro: "Origem não permitida" }, 403);
  const u = await lerSessao(request, env);
  if (!u) return json({ erro: "Não autenticado" }, 401);
  const id = idDaUrl(request);
  if (!id) return json({ erro: "id obrigatório" }, 400);
  if (!(await ehDono(env, id, u.userId))) return json({ erro: "Disciplina não encontrada" }, 404);
  const lido = await lerJson(request);
  if (lido.grande) return json({ erro: "Corpo da requisição muito grande" }, 413);
  const body = lido.body;
  const msg = validar(body);
  if (msg) return json({ erro: msg }, 400);
  await env.DB.batch([
    env.DB.prepare("UPDATE disciplinas SET nome = ?, media_aprovacao = ?, media_exame = ? WHERE id = ? AND user_id = ?")
      .bind(body.nome.trim(), body.media_aprovacao, body.media_exame, id, u.userId),
    env.DB.prepare("DELETE FROM avaliacoes WHERE disciplina_id = ?").bind(id),
    ...stmtsAvaliacoes(env, id, body.avaliacoes),
  ]);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  if (origemInvalida(request, env)) return json({ erro: "Origem não permitida" }, 403);
  const u = await lerSessao(request, env);
  if (!u) return json({ erro: "Não autenticado" }, 401);
  const id = idDaUrl(request);
  if (!id) return json({ erro: "id obrigatório" }, 400);
  if (!(await ehDono(env, id, u.userId))) return json({ erro: "Disciplina não encontrada" }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM avaliacoes WHERE disciplina_id = ?").bind(id),
    env.DB.prepare("DELETE FROM disciplinas WHERE id = ? AND user_id = ?").bind(id, u.userId),
  ]);
  return json({ ok: true });
}
