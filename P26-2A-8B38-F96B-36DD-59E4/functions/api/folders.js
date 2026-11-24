import { sessao } from "../_lib/auth.js";
const json = (d, s = 200) => Response.json(d, { status: s });

export async function onRequest({ request, env }) {
  const u = await sessao(request, env);
  if (!u) return json({ ok: false, error: "Faça login com o Discord." }, 401);
  const db = env.DB, url = new URL(request.url);

  if (request.method === "GET") {
    const r = await db.prepare("SELECT f.id, f.name, (SELECT COUNT(*) FROM refs r WHERE r.folder_id = f.id) AS total FROM folders f WHERE f.user_id = ? ORDER BY f.name COLLATE NOCASE").bind(u.userId).all();
    return json({ ok: true, folders: r.results });
  }
  if (request.method === "POST") {
    const b = await request.json().catch(() => ({}));
    const name = String(b.name || "").trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > 60) return json({ ok: false, error: "O nome da pasta deve ter de 1 a 60 caracteres." }, 400);
    const n = await db.prepare("SELECT COUNT(*) AS c FROM folders WHERE user_id = ?").bind(u.userId).first();
    if (n.c >= 50) return json({ ok: false, error: "Limite de 50 pastas." }, 400);
    try {
      const r = await db.prepare("INSERT INTO folders (user_id, name) VALUES (?, ?)").bind(u.userId, name).run();
      return json({ ok: true, id: r.meta.last_row_id }, 201);
    } catch { return json({ ok: false, error: "Você já tem uma pasta com esse nome." }, 409); }
  }
  if (request.method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    const f = await db.prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?").bind(id, u.userId).first();
    if (!f) return json({ ok: false, error: "Pasta não encontrada." }, 404);
    await db.batch([db.prepare("DELETE FROM refs WHERE folder_id = ?").bind(id), db.prepare("DELETE FROM folders WHERE id = ?").bind(id)]);
    return json({ ok: true });
  }
  return json({ ok: false, error: "Método não permitido." }, 405);
}
