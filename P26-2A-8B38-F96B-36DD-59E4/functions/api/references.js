import { sessao } from "../_lib/auth.js";
import { formatar, limpar, validar, chaveOrdem } from "../../public/formatar.js";
const json = (d, s = 200) => Response.json(d, { status: s });

export async function onRequest({ request, env }) {
  const u = await sessao(request, env);
  if (!u) return json({ ok: false, error: "Faça login com o Discord." }, 401);
  const db = env.DB, url = new URL(request.url);
  const dono = (id) => db.prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?").bind(id, u.userId).first();

  if (request.method === "GET") {
    const fid = Number(url.searchParams.get("folder_id"));
    if (!(await dono(fid))) return json({ ok: false, error: "Pasta não encontrada." }, 404);
    const { results } = await db.prepare("SELECT id, norma, tipo, dados FROM refs WHERE folder_id = ? AND user_id = ? ORDER BY id DESC").bind(fid, u.userId).all();
    const refs = results.map((r) => {
      const v = limpar(r.norma, r.tipo, JSON.parse(r.dados));
      return { id: r.id, norma: r.norma, segs: formatar(v), ordem: chaveOrdem(v) };
    });
    if (url.searchParams.get("compilar")) refs.sort((a, b) => a.ordem.localeCompare(b.ordem, "pt-BR"));
    return json({ ok: true, refs: refs.map(({ ordem, ...r }) => r) });
  }
  if (request.method === "POST") {
    const b = await request.json().catch(() => ({}));
    const v = limpar(b.norma, b.tipo, b.dados);
    if (!v) return json({ ok: false, error: "Norma ou tipo inválido." }, 400);
    const erro = validar(v);
    if (erro) return json({ ok: false, error: erro }, 400);
    const fid = Number(b.folder_id);
    if (!(await dono(fid))) return json({ ok: false, error: "Pasta não encontrada." }, 404);
    const n = await db.prepare("SELECT COUNT(*) AS c FROM refs WHERE folder_id = ?").bind(fid).first();
    if (n.c >= 300) return json({ ok: false, error: "Limite de 300 referências por pasta." }, 400);
    await db.prepare("INSERT INTO refs (folder_id, user_id, norma, tipo, dados) VALUES (?, ?, ?, ?, ?)").bind(fid, u.userId, v.norma, v.tipo, JSON.stringify(v)).run();
    return json({ ok: true }, 201);
  }
  if (request.method === "DELETE") {
    const r = await db.prepare("DELETE FROM refs WHERE id = ? AND user_id = ?").bind(Number(url.searchParams.get("id")), u.userId).run();
    const ok = r.meta.changes > 0;
    return json({ ok }, ok ? 200 : 404);
  }
  return json({ ok: false, error: "Método não permitido." }, 405);
}
