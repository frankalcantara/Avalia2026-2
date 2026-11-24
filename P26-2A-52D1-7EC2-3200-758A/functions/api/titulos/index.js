/**
 * /api/titulos
 *   GET  → galeria: cada título com a MÉDIA aritmética e o TOTAL de avaliações,
 *          calculados no servidor. Ordenação: ?ordem=media | popularidade | recentes
 *          Filtros opcionais: ?tipo=filme|serie  ?busca=texto
 *   POST → cadastra um novo filme ou série (exige login).
 */
import { erro, json, lerJson, limparTexto, usuarioAtual } from "../../../lib/servidor.js";

const ORDENS = {
  media: "media DESC, total DESC, t.nome COLLATE NOCASE ASC",
  popularidade: "total DESC, media DESC, t.nome COLLATE NOCASE ASC",
  recentes: "t.ano_lancamento DESC, t.id DESC",
};
const ANO_MAXIMO = () => new Date().getUTCFullYear() + 2;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const ordem = ORDENS[url.searchParams.get("ordem")] ? url.searchParams.get("ordem") : "media";
  const tipo = url.searchParams.get("tipo");
  const busca = limparTexto(url.searchParams.get("busca")).slice(0, 60);
  const usuario = await usuarioAtual(env, request);

  const filtros = [];
  const params = [usuario ? usuario.user_id : ""];
  if (tipo === "filme" || tipo === "serie") {
    filtros.push("t.tipo = ?");
    params.push(tipo);
  }
  if (busca) {
    filtros.push("t.nome LIKE ? ESCAPE '\\'");
    params.push(`%${busca.replace(/[\\%_]/g, (c) => "\\" + c)}%`);
  }

  // Média e total agregados no servidor (AVG e COUNT), direto do D1
  const sql = `
    SELECT t.id, t.nome, t.tipo, t.ano_lancamento, t.genero,
           ROUND(COALESCE(AVG(a.nota), 0), 2) AS media,
           COUNT(a.nota) AS total,
           (SELECT nota FROM avaliacoes WHERE filme_id = t.id AND user_id = ?) AS minha_nota
      FROM titulos t
      LEFT JOIN avaliacoes a ON a.filme_id = t.id
     ${filtros.length ? "WHERE " + filtros.join(" AND ") : ""}
     GROUP BY t.id
     ORDER BY ${ORDENS[ordem]}`;

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ ok: true, ordem, titulos: results });
}

export async function onRequestPost({ request, env }) {
  const usuario = await usuarioAtual(env, request);
  if (!usuario) return erro("Faça login com o Discord para cadastrar títulos.", 401);

  const corpo = await lerJson(request);
  const nome = limparTexto(corpo.nome);
  const tipo = corpo.tipo;
  const ano = Number(corpo.ano_lancamento);
  const genero = limparTexto(corpo.genero).slice(0, 40) || null;

  if (nome.length < 1 || nome.length > 120) return erro("O nome deve ter entre 1 e 120 caracteres.");
  if (tipo !== "filme" && tipo !== "serie") return erro("O tipo deve ser 'filme' ou 'serie'.");
  if (!Number.isInteger(ano) || ano < 1888 || ano > ANO_MAXIMO()) return erro(`O ano deve ser um número entre 1888 e ${ANO_MAXIMO()}.`);

  const existente = await env.DB.prepare(
    "SELECT id FROM titulos WHERE nome = ? COLLATE NOCASE AND ano_lancamento = ? AND tipo = ?"
  ).bind(nome, ano, tipo).first();
  if (existente) return json({ ok: false, erro: "Esse título já está no catálogo.", id: existente.id }, 409);

  const res = await env.DB.prepare(
    "INSERT INTO titulos (nome, tipo, ano_lancamento, genero, criado_por) VALUES (?, ?, ?, ?, ?)"
  ).bind(nome, tipo, ano, genero, usuario.user_id).run();

  return json({ ok: true, id: res.meta.last_row_id }, 201);
}
