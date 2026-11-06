/**
 * /api/items
 *  GET  — lista os itens da vitrine (público). Filtros opcionais por query string:
 *         tipo, categoria, status, q (busca em título/local/descrição), meus=1
 *         A interface carrega a lista uma vez e cruza os filtros na hora (sem novo request).
 *  POST — cadastra um item (exige login). Todas as regras são validadas aqui no servidor.
 */
import { json, erro, lerJson, texto, TIPOS, CATEGORIAS, STATUS_ITEM } from "../../_lib/http.js";
import { avatarUrl } from "../../_lib/auth.js";

const LIMITE_POR_DIA = 20;

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const userId = data.user?.user_id || "";
  const where = [];
  const binds = [];

  const tipo = url.searchParams.get("tipo");
  const categoria = url.searchParams.get("categoria");
  const status = url.searchParams.get("status");
  const q = texto(url.searchParams.get("q") || "").slice(0, 60);

  if (tipo) {
    if (!TIPOS.includes(tipo)) return erro(400, "tipo_invalido", "Tipo inválido.");
    where.push("i.tipo = ?"); binds.push(tipo);
  }
  if (categoria) {
    if (!CATEGORIAS.includes(categoria)) return erro(400, "categoria_invalida", "Categoria inválida.");
    where.push("i.categoria = ?"); binds.push(categoria);
  }
  if (status) {
    if (!STATUS_ITEM.includes(status)) return erro(400, "status_invalido", "Status inválido.");
    where.push("i.status = ?"); binds.push(status);
  }
  if (q) {
    // O D1 limita o padrão do LIKE a 50 bytes (SQLITE_LIMIT_LIKE_PATTERN_LENGTH); acima disso
    // a consulta falha com "LIKE or GLOB pattern too complex" (500). Os dois "%" usam 2 bytes.
    const enc = new TextEncoder();
    let termo = Array.from(q.replace(/[%_]/g, ""));
    while (termo.length && enc.encode(termo.join("")).length > 48) termo.pop();
    const like = `%${termo.join("")}%`;
    where.push("(i.titulo LIKE ? OR i.local LIKE ? OR i.descricao LIKE ?)");
    binds.push(like, like, like);
  }
  if (url.searchParams.get("meus") === "1") {
    if (!userId) return erro(401, "nao_autenticado", "Faça login para ver seus itens.");
    where.push("i.owner_id = ?"); binds.push(userId);
  }

  const sql = `
    SELECT i.id, i.tipo, i.categoria, i.titulo, i.local, i.data_ocorrencia, i.descricao,
           i.status, i.owner_id, i.created_at, i.closed_at,
           u.global_name AS owner_nome, u.username AS owner_username, u.avatar AS owner_avatar,
           (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id AND c.status = 'pendente') AS reivindicacoes_pendentes,
           (SELECT c.status FROM claims c WHERE c.item_id = i.id AND c.claimant_id = ?
             ORDER BY c.id DESC LIMIT 1) AS minha_reivindicacao
      FROM items i
      JOIN discord_users u ON u.user_id = i.owner_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY CASE i.status WHEN 'aberto' THEN 0 WHEN 'em_devolucao' THEN 1 ELSE 2 END,
              i.data_ocorrencia DESC, i.id DESC
     LIMIT 500`;

  const { results } = await env.DB.prepare(sql).bind(userId, ...binds).all();

  const itens = (results || []).map((r) => ({
    id: r.id,
    tipo: r.tipo,
    categoria: r.categoria,
    titulo: r.titulo,
    local: r.local,
    data_ocorrencia: r.data_ocorrencia,
    descricao: r.descricao,
    status: r.status,
    created_at: r.created_at,
    closed_at: r.closed_at,
    autor: {
      nome: r.owner_nome || r.owner_username,
      avatar_url: avatarUrl(r.owner_id, r.owner_avatar),
    },
    eh_meu: Boolean(userId) && r.owner_id === userId,
    reivindicacoes_pendentes: r.reivindicacoes_pendentes,
    minha_reivindicacao: r.minha_reivindicacao || null,
  }));

  return json({ ok: true, total: itens.length, itens });
}

function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(valor + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) return false;
  // "hoje" no horário de Brasília (UTC-3, sem horário de verão desde 2019)
  const hojeBrasilia = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const umAnoAtras = Date.now() - 366 * 86400 * 1000;
  return valor <= hojeBrasilia && d.getTime() >= umAnoAtras;
}

export function validarItem(body) {
  const erros = {};
  const item = {
    tipo: texto(body.tipo),
    categoria: texto(body.categoria),
    titulo: texto(body.titulo).replace(/\s+/g, " "),
    local: texto(body.local).replace(/\s+/g, " "),
    data_ocorrencia: texto(body.data_ocorrencia),
    descricao: texto(body.descricao),
  };
  if (!TIPOS.includes(item.tipo)) erros.tipo = "Escolha \"Perdi\" ou \"Encontrei\".";
  if (!CATEGORIAS.includes(item.categoria)) erros.categoria = "Categoria inválida.";
  if (item.titulo.length < 3 || item.titulo.length > 80) erros.titulo = "O título deve ter entre 3 e 80 caracteres.";
  if (item.local.length < 3 || item.local.length > 120) erros.local = "Informe o local exato (3 a 120 caracteres).";
  if (!dataValida(item.data_ocorrencia)) erros.data_ocorrencia = "Data inválida: use uma data dos últimos 12 meses que não esteja no futuro.";
  if (item.descricao.length < 10 || item.descricao.length > 1000) erros.descricao = "A descrição deve ter entre 10 e 1000 caracteres.";
  return { item, erros };
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user; // garantido pelo middleware
  const { body, erro: e } = await lerJson(request);
  if (e) return e;

  const { item, erros } = validarItem(body);
  if (Object.keys(erros).length) return erro(400, "validacao", "Confira os campos destacados.", erros);

  const recentes = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM items WHERE owner_id = ? AND created_at > datetime('now', '-1 day')"
  ).bind(user.user_id).first();
  if ((recentes?.n || 0) >= LIMITE_POR_DIA) {
    return erro(429, "limite_diario", `Limite de ${LIMITE_POR_DIA} cadastros por dia atingido.`);
  }

  const r = await env.DB.prepare(
    `INSERT INTO items (tipo, categoria, titulo, local, data_ocorrencia, descricao, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  )
    .bind(item.tipo, item.categoria, item.titulo, item.local, item.data_ocorrencia, item.descricao, user.user_id)
    .first();

  return json({ ok: true, id: r.id, item: { id: r.id, ...item, status: "aberto" } }, 201);
}
