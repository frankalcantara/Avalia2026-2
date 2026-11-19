// GET /api/polls/:id: detalhe da enquete. Resultados só aparecem se o usuário já votou
// ou se o prazo venceu (o parcial não influencia quem ainda vai votar).
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { json, methodNotAllowed, notFoundPoll, parseId, safe, unauthorized } from "../../../_lib/http.js";
import { getSessionUser } from "../../../_lib/session.js";
import { buildResults } from "../../../_lib/polls.js";

// Carrega opções e contagem de votos e monta os resultados (reutilizado por vote.js).
export async function loadResults(env, pollId) {
  const [opts, counts] = await env.DB.batch([
    env.DB.prepare("SELECT id, label FROM poll_options WHERE poll_id = ? ORDER BY position").bind(pollId),
    env.DB.prepare("SELECT option_id, COUNT(*) AS votes FROM votes WHERE poll_id = ? GROUP BY option_id").bind(pollId),
  ]);
  return { options: opts.results, results: buildResults(opts.results, counts.results) };
}

export const onRequestGet = safe(async ({ request, env, params }) => {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();
  const id = parseId(params.id);
  if (!id) return notFoundPoll();

  const poll = await env.DB.prepare(
    `SELECT p.id, p.title, p.description, p.closes_at, u.username, u.avatar_url,
            (SELECT option_id FROM votes v WHERE v.poll_id = p.id AND v.user_id = ?) AS my_option_id
       FROM polls p JOIN users u ON u.user_id = p.creator_id WHERE p.id = ?`
  ).bind(user.user_id, id).first();
  if (!poll) return notFoundPoll();

  const now = Date.now();
  const isOpen = now < poll.closes_at;
  const hasVoted = poll.my_option_id != null;
  const { options, results } = await loadResults(env, id);

  return json({
    ok: true,
    server_now: now,
    poll: {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      closes_at: poll.closes_at,
      is_open: isOpen,
      has_voted: hasVoted,
      my_option_id: hasVoted ? poll.my_option_id : null,
      total_votes: results.total_votes,
      creator: { username: poll.username, avatar_url: poll.avatar_url },
      options,
      results: hasVoted || !isOpen ? results : null,
    },
  });
});

export const onRequest = () => methodNotAllowed("GET");
