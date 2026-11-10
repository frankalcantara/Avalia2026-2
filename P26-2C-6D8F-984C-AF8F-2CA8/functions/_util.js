// Helpers compartilhados pelas Functions (sem handlers onRequest => não vira rota).
import { calcular } from "../public/js/calculo.js";

export const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export function lerCookie(request, nome) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${nome}=([^;]*)`));
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; } // cookie malformado = sem sessão
}

export function tokenAleatorio(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const cookie = (nome, valor, maxAge) =>
  `${nome}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** Carrega disciplinas do usuário (todas, ou só `id`) com avaliações e resumo recalculado no servidor. */
export async function carregarDisciplinas(DB, userId, id = null) {
  const filtro = id === null ? "" : " AND d.id = ?";
  const args = id === null ? [userId] : [userId, id];
  const [ds, avs] = await DB.batch([
    DB.prepare(
      `SELECT d.id, d.nome, d.nota_max, d.media_aprovacao, d.media_exame, d.media_final, d.updated_at
       FROM disciplinas d WHERE d.user_id = ?${filtro} ORDER BY d.id`
    ).bind(...args),
    DB.prepare(
      `SELECT a.id, a.disciplina_id, a.nome, a.tipo, a.peso, a.nota
       FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
       WHERE d.user_id = ?${filtro} ORDER BY a.disciplina_id, a.ordem`
    ).bind(...args),
  ]);
  return ds.results.map((r) => {
    const avaliacoes = avs.results
      .filter((a) => a.disciplina_id === r.id)
      .map(({ id, nome, tipo, peso, nota }) => ({ id, nome, tipo, peso, nota }));
    const d = {
      id: r.id, nome: r.nome, notaMax: r.nota_max,
      mediaAprovacao: r.media_aprovacao, mediaExame: r.media_exame, mediaFinal: r.media_final,
      avaliacoes,
    };
    return { ...d, resumo: calcular(d), updatedAt: r.updated_at };
  });
}

/** Statements de insert das avaliações; `discIdSql` é "?" ou uma subquery que resolve o id. */
export function insertsAvaliacoes(DB, discIdSql, discIdArgs, avaliacoes) {
  return avaliacoes.map((a, i) =>
    DB.prepare(
      `INSERT INTO avaliacoes (disciplina_id, ordem, nome, tipo, peso, nota) VALUES ((${discIdSql}), ?, ?, ?, ?, ?)`
    ).bind(...discIdArgs, i, a.nome, a.tipo, a.peso, a.nota)
  );
}
