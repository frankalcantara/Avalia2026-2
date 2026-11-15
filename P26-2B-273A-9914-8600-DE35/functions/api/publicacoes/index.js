/**
 * Cloudflare Pages Functions — /api/publicacoes
 *
 *   GET  lista as publicacoes, ordenadas pelos mais votados
 *   POST cria uma publicacao (exige sessao)
 */

import { usuarioDaRequisicao } from "../../_lib/sessao.js";
import { CATEGORIAS, categoriaValida, tipoValido } from "../../_lib/categorias.js";

const LIMITE_PADRAO = 100;
const TITULO_MAXIMO = 120;
const CONTEUDO_MAXIMO = 5000;

/**
 * Monta a URL do avatar a partir do hash. O Discord nao entrega URL pronta, e
 * quando a pessoa nao tem avatar o campo vem nulo — nesse caso o avatar padrao
 * e derivado do proprio id.
 */
function urlDoAvatar(userId, hash) {
  if (hash) {
    const extensao = hash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${extensao}?size=64`;
  }
  const indice = Number((BigInt(userId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${indice}.png`;
}

// ---------------------------------------------------------------- listagem

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const busca = (url.searchParams.get("q") || "").trim();
  const categoria = (url.searchParams.get("categoria") || "").trim();

  // Quem esta pedindo. Nao e obrigatorio estar logado para LER — a biblioteca
  // e da turma. Mas saber quem e permite marcar o que a pessoa ja votou, para
  // a interface mostrar o botao no estado certo.
  const usuarioId = await usuarioDaRequisicao(request, env);

  const condicoes = [];
  const parametros = [];

  if (busca) {
    // LIKE com parametros vinculados. NUNCA concatenar: a caixa de busca e
    // texto do usuario indo direto para uma consulta, que e o caminho obvio
    // de injecao neste projeto.
    condicoes.push("(titulo LIKE ?1 OR conteudo LIKE ?1 OR categoria LIKE ?1)");
    parametros.push(`%${busca}%`);
  }

  if (categoria && categoriaValida(categoria)) {
    condicoes.push(`categoria = ?${parametros.length + 1}`);
    parametros.push(categoria);
  }

  const onde = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

  // A ordenacao por votos vem do banco, nao do JavaScript: ordenar no cliente
  // so funcionaria se ele tivesse a lista inteira, o que deixa de valer assim
  // que houver paginacao.
  const consulta = `
    SELECT id, autor_id, autor_nome, autor_avatar, tipo, titulo, conteudo,
           categoria, criado_em, total_votos
    FROM publicacoes_com_votos
    ${onde}
    ORDER BY total_votos DESC, criado_em DESC
    LIMIT ${LIMITE_PADRAO}
  `;

  const { results } = await env.DB.prepare(consulta)
    .bind(...parametros)
    .all();

  // Quais destas o usuario atual ja votou. Consulta separada para nao
  // complicar a view com um parametro que muda a cada requisicao.
  let jaVotadas = new Set();
  if (usuarioId && results.length) {
    const { results: votos } = await env.DB.prepare(
      "SELECT publicacao_id FROM votos WHERE usuario_id = ?"
    )
      .bind(usuarioId)
      .all();
    jaVotadas = new Set(votos.map((v) => v.publicacao_id));
  }

  return Response.json({
    categorias: CATEGORIAS,
    autenticado: Boolean(usuarioId),
    publicacoes: results.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      titulo: p.titulo,
      conteudo: p.conteudo,
      categoria: p.categoria,
      criadoEm: p.criado_em,
      totalVotos: p.total_votos,
      jaVotei: jaVotadas.has(p.id),
      souAutor: usuarioId === p.autor_id,
      autor: {
        nome: p.autor_nome,
        avatarUrl: urlDoAvatar(p.autor_id, p.autor_avatar),
      },
    })),
  });
}

// ------------------------------------------------------------------ criar

export async function onRequestPost({ request, env }) {
  const usuarioId = await usuarioDaRequisicao(request, env);
  if (!usuarioId) {
    return Response.json({ erro: "Entre com o Discord para publicar." }, { status: 401 });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const titulo = String(corpo?.titulo ?? "").trim();
  const conteudo = String(corpo?.conteudo ?? "").trim();
  const tipo = String(corpo?.tipo ?? "").trim();
  const categoria = String(corpo?.categoria ?? "").trim();

  // Toda validacao acontece aqui. A interface tem <select> e maxlength, mas
  // isso e conveniencia para quem usa — qualquer um manda o que quiser no
  // corpo da requisicao, e quem recusa e este bloco.
  const erros = [];
  if (titulo.length < 3 || titulo.length > TITULO_MAXIMO) {
    erros.push(`título deve ter de 3 a ${TITULO_MAXIMO} caracteres`);
  }
  if (conteudo.length < 1 || conteudo.length > CONTEUDO_MAXIMO) {
    erros.push(`conteúdo deve ter de 1 a ${CONTEUDO_MAXIMO} caracteres`);
  }
  if (!tipoValido(tipo)) erros.push("tipo deve ser 'resumo' ou 'snippet'");
  if (!categoriaValida(categoria)) erros.push("categoria fora da lista permitida");

  if (erros.length) return Response.json({ erro: erros.join("; ") }, { status: 400 });

  // O autor vem da SESSAO. Se o cliente mandar um campo autor_id no corpo,
  // ele e simplesmente ignorado — nao existe caminho para forjar autoria.
  const criada = await env.DB.prepare(
    `INSERT INTO publicacoes (autor_id, tipo, titulo, conteudo, categoria)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id`
  )
    .bind(usuarioId, tipo, titulo, conteudo, categoria)
    .first();

  return Response.json({ id: criada.id }, { status: 201 });
}
