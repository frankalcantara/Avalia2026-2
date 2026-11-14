import { json, autenticar, textoValido } from "../../../lib/util.js";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
const gerarCodigo = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALFABETO[b % ALFABETO.length]).join("");

export async function onRequestGet({ request, env }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const { results } = await env.DB.prepare(
    `SELECT l.id, l.name, l.code, l.owner_id,
            (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.parent_id IS NULL) AS total,
            (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.parent_id IS NULL AND t.done = 1) AS feitas
     FROM lists l JOIN list_members m ON m.list_id = l.id
     WHERE m.user_id = ? ORDER BY l.id DESC`
  ).bind(u.id).all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const corpo = await request.json().catch(() => null);
  const nome = textoValido(corpo?.nome, 80);
  if (!nome) return json({ erro: "Nome da lista inválido (1 a 80 caracteres)." }, 400);

  for (let i = 0; i < 5; i++) {
    try {
      const r = await env.DB.prepare("INSERT INTO lists (name, code, owner_id) VALUES (?, ?, ?)")
        .bind(nome, gerarCodigo(), u.id).run();
      const id = r.meta.last_row_id;
      await env.DB.prepare("INSERT INTO list_members (list_id, user_id) VALUES (?, ?)").bind(id, u.id).run();
      return json({ id }, 201);
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e; // colisão de código: tenta outro
    }
  }
  return json({ erro: "Não foi possível gerar um código de acesso." }, 500);
}
