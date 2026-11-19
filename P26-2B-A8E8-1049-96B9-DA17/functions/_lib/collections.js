import { fail } from "./http.js";

export const MAX_COLLECTION_NAME = 60;

export function validateName(body) {
  const v = body.name;
  if (typeof v !== "string") return { fields: { name: "O nome é obrigatório." } };
  const name = v.trim().replace(/\s+/g, " ");
  if (!name) return { fields: { name: "O nome é obrigatório." } };
  if (name.length > MAX_COLLECTION_NAME) return { fields: { name: `Máximo de ${MAX_COLLECTION_NAME} caracteres.` } };
  return { name };
}

export const isUnique = (e) => /UNIQUE/i.test(String(e?.message ?? e)) || /UNIQUE/i.test(String(e?.cause?.message ?? ""));

/** Busca a coleção e checa o dono. Retorna {col} ou {response}. */
export async function loadOwned(env, id, userId) {
  const col = await env.DB.prepare("SELECT id, user_id, name FROM collections WHERE id = ?").bind(id).first();
  if (!col) return { response: fail(404, "Coleção não encontrada.") };
  if (col.user_id !== userId) return { response: fail(403, "Você não pode alterar a coleção de outro usuário.") };
  return { col };
}

export async function countOf(env, id) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS count FROM collection_quotes WHERE collection_id = ?").bind(id).first();
  return r?.count ?? 0;
}
