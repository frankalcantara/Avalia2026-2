// POST /api/polls/:id/vote: registra o voto do usuário da sessão.
// Ordem do SPEC: 401 sessão → 404 enquete → 403 prazo → 400 opção → 409 duplicado.
// O INSERT é condicional ao prazo e à opção; UNIQUE(poll_id,user_id) cobre corrida entre abas.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { checkPost, error, json, methodNotAllowed, notFoundPoll, parseId, readJson, safe, unauthorized } from "../../../_lib/http.js";
import { getSessionUser } from "../../../_lib/session.js";
import { loadResults } from "./index.js";

const closed = () => error(403, "enquete_encerrada", "O prazo desta enquete já terminou.");
const badOption = () => error(400, "opcao_invalida", "Opção inválida para esta enquete.");
const duplicate = () => error(409, "voto_duplicado", "Você já votou nesta enquete.");

export const onRequestPost = safe(async ({ request, env, params }) => {
  // 1) Sessão (o user_id nunca vem do corpo).
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();
  const csrf = checkPost(request);
  if (csrf) return csrf;
  const body = await readJson(request); // corpo inválido vira opcao_invalida no passo 4

  // 2) Enquete existe.
  const id = parseId(params.id);
  if (!id) return notFoundPoll();
  const poll = await env.DB.prepare("SELECT id, closes_at FROM polls WHERE id = ?").bind(id).first();
  if (!poll) return notFoundPoll();

  // 3) Prazo pelo relógio do servidor.
  if (Date.now() >= poll.closes_at) return closed();

  // 4) Opção pertence à enquete.
  const optionId = body.ok ? body.value.option_id : null;
  if (!Number.isSafeInteger(optionId) || optionId <= 0) return badOption();
  const opt = await env.DB.prepare("SELECT id FROM poll_options WHERE id = ? AND poll_id = ?").bind(optionId, id).first();
  if (!opt) return badOption();

  // 5) Já votou.
  const prev = await env.DB.prepare("SELECT 1 FROM votes WHERE poll_id = ? AND user_id = ?").bind(id, user.user_id).first();
  if (prev) return duplicate();

  // Inserção atômica: só grava se a opção é da enquete e o prazo ainda não venceu.
  let res;
  try {
    res = await env.DB.prepare(
      `INSERT INTO votes (poll_id, option_id, user_id)
       SELECT p.id, o.id, ? FROM polls p JOIN poll_options o ON o.poll_id = p.id
        WHERE p.id = ? AND o.id = ? AND p.closes_at > ?`
    ).bind(user.user_id, id, optionId, Date.now()).run();
  } catch (e) {
    if (String(e && e.message).includes("UNIQUE constraint failed")) return duplicate();
    throw e;
  }
  // Nenhuma linha inserida: o prazo venceu entre a checagem e o INSERT.
  if (!res.meta || !res.meta.changes) return closed();

  const { results } = await loadResults(env, id);
  return json({ ok: true, results, my_option_id: optionId }, 201);
});

export const onRequest = () => methodNotAllowed("POST");
