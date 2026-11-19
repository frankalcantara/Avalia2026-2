import { readSession, json } from "../../../_lib/session.js";

export async function onRequestPost({ request, env, params }) {
  const user = await readSession(request, env);
  if (!user) return json({ ok: false, error: "Faça login com o Discord." }, 401);

  const id = Number(params.id);
  const action = params.action;
  if (!Number.isInteger(id)) return json({ ok: false, error: "ID inválido." }, 400);
  if (!["accept", "reject", "close"].includes(action))
    return json({ ok: false, error: "Ação inválida." }, 400);

  const claim = await env.DB.prepare(
    `SELECT c.id, c.item_id, c.claimant_id, c.status, i.owner_id
     FROM claims c JOIN items i ON i.id = c.item_id WHERE c.id = ?`
  ).bind(id).first();
  if (!claim) return json({ ok: false, error: "Reivindicação não encontrada." }, 404);

  const isOwner = claim.owner_id === user.userId;
  const isClaimant = claim.claimant_id === user.userId;

  if (action === "accept" || action === "reject") {
    if (!isOwner) return json({ ok: false, error: "Só o dono do item pode responder." }, 403);
    if (claim.status !== "pendente")
      return json({ ok: false, error: "Esta reivindicação não está pendente." }, 409);

    if (action === "reject") {
      await env.DB.prepare("UPDATE claims SET status = 'recusada' WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    await env.DB.batch([
      env.DB.prepare("UPDATE claims SET status = 'aceita', owner_contact = ? WHERE id = ?")
        .bind(user.username, id),
      env.DB.prepare("UPDATE items SET status = 'em_andamento' WHERE id = ?").bind(claim.item_id),
    ]);
    return json({ ok: true });
  }

  // close
  if (!isOwner && !isClaimant)
    return json({ ok: false, error: "Você não participa deste caso." }, 403);
  if (claim.status !== "aceita")
    return json({ ok: false, error: "Só é possível encerrar uma reivindicação aceita." }, 409);

  await env.DB.batch([
    env.DB.prepare("UPDATE claims SET status = 'encerrada', closed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
    env.DB.prepare("UPDATE items SET status = 'encerrado' WHERE id = ?").bind(claim.item_id),
  ]);
  return json({ ok: true });
}