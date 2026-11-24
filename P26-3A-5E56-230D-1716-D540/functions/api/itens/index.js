/**
 * GET  /api/itens  (público) — lista com filtros cruzados (docs/ESPECIFICACAO.md 4.1).
 *   200 { itens: [Item], total, pagina, por_pagina, contagens: { por_categoria: {...}, por_tipo: {...} } }
 *   `contagens` considera TODOS os filtros aplicados (antes da paginação) e traz todas as chaves com 0.
 *   ordem=recentes|antigos ordena por criado_em (data de publicação).
 *   meus=1 sem login → 401. Filtro inválido → 400.
 * POST /api/itens  (logado) — cria item (4.2). 201 { item: Item }. Limite 10/hora/usuário → 429.
 */
import { exigirUsuario, falha, json, lerJson, porMetodo } from "../../_lib/http.js";
import { CATEGORIAS, TIPOS, validarFiltros, validarItem } from "../../_lib/validacao.js";
import { SELECT_ITEM, buscarItem, serializarItem } from "../../_lib/repositorio.js";

const LIMITE_POR_HORA = 10;

function montarWhere(f, usuario) {
  const clausulas = [];
  const params = [];
  if (f.status === null) clausulas.push(`i.status <> 'encerrado'`);
  else if (f.status !== "todos") {
    clausulas.push(`i.status = ?`);
    params.push(f.status);
  }
  if (f.tipo) {
    clausulas.push(`i.tipo = ?`);
    params.push(f.tipo);
  }
  if (f.categoria) {
    clausulas.push(`i.categoria = ?`);
    params.push(f.categoria);
  }
  // Busca por substring com instr(), não LIKE: o D1 limita o padrão do LIKE a 50 bytes
  // ("LIKE or GLOB pattern too complex") e instr() trata % e _ como texto literal.
  // lower() do SQLite só converte ASCII — mesma semântica que o LIKE tinha.
  if (f.q) {
    clausulas.push(
      `(instr(lower(i.titulo), lower(?)) > 0 OR instr(lower(i.descricao), lower(?)) > 0 OR instr(lower(i.local), lower(?)) > 0)`,
    );
    params.push(f.q, f.q, f.q);
  }
  if (f.local) {
    clausulas.push(`instr(lower(i.local), lower(?)) > 0`);
    params.push(f.local);
  }
  if (f.de) {
    clausulas.push(`i.data_ocorrencia >= ?`);
    params.push(f.de);
  }
  if (f.ate) {
    clausulas.push(`i.data_ocorrencia <= ?`);
    params.push(f.ate);
  }
  if (f.meus) {
    clausulas.push(`i.autor_id = ?`);
    params.push(usuario.user_id);
  }
  return { where: clausulas.length ? `WHERE ${clausulas.join(" AND ")}` : "", params };
}

function contagem(chaves, linhas, campo) {
  const saida = Object.fromEntries(chaves.map((k) => [k, 0]));
  for (const l of linhas) if (l[campo] in saida) saida[l[campo]] = Number(l.n);
  return saida;
}

async function listar({ request, env, data }) {
  const v = validarFiltros(new URL(request.url).searchParams);
  if (!v.ok) throw falha.invalido("Filtro inválido.", v.erros);
  const f = v.valor;
  if (f.meus && !data.usuario) throw falha.naoLogado();

  const { where, params } = montarWhere(f, data.usuario);
  const ordem = f.ordem === "antigos" ? "ASC" : "DESC";
  const offset = (f.pagina - 1) * f.por_pagina;

  const [lista, total, porCategoria, porTipo] = await env.DB.batch([
    env.DB.prepare(`${SELECT_ITEM} ${where} ORDER BY i.criado_em ${ordem}, i.id ${ordem} LIMIT ? OFFSET ?`).bind(
      ...params,
      f.por_pagina,
      offset,
    ),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM itens i ${where}`).bind(...params),
    env.DB.prepare(`SELECT i.categoria, COUNT(*) AS n FROM itens i ${where} GROUP BY i.categoria`).bind(...params),
    env.DB.prepare(`SELECT i.tipo, COUNT(*) AS n FROM itens i ${where} GROUP BY i.tipo`).bind(...params),
  ]);

  return json({
    itens: lista.results.map(serializarItem),
    total: Number(total.results[0].n),
    pagina: f.pagina,
    por_pagina: f.por_pagina,
    contagens: {
      por_categoria: contagem(CATEGORIAS, porCategoria.results, "categoria"),
      por_tipo: contagem(TIPOS, porTipo.results, "tipo"),
    },
  });
}

async function criar(context) {
  const usuario = exigirUsuario(context);
  const corpo = await lerJson(context.request);
  const v = validarItem(corpo);
  if (!v.ok) throw falha.invalido("Dados do item inválidos.", v.erros);
  const it = v.valor;

  // Inserção condicionada ao limite na MESMA instrução (atômica, sem corrida entre contar e inserir).
  const novo = await context.env.DB.prepare(
    `INSERT INTO itens (autor_id, tipo, categoria, titulo, descricao, local, data_ocorrencia, status)
     SELECT ?, ?, ?, ?, ?, ?, ?, 'aberto'
      WHERE (SELECT COUNT(*) FROM itens
              WHERE autor_id = ? AND datetime(criado_em) > datetime('now', '-1 hour')) < ?
     RETURNING id`,
  )
    .bind(
      usuario.user_id,
      it.tipo,
      it.categoria,
      it.titulo,
      it.descricao,
      it.local,
      it.data_ocorrencia,
      usuario.user_id,
      LIMITE_POR_HORA,
    )
    .first();
  if (!novo) {
    throw falha.limite(`Limite de ${LIMITE_POR_HORA} itens por hora atingido. Tente mais tarde.`);
  }
  const linha = await buscarItem(context.env, novo.id);
  return json({ item: serializarItem(linha) }, 201);
}

export const onRequest = porMetodo({ GET: listar, POST: criar });
