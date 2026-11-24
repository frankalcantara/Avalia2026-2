/**
 * Cloudflare Pages Function — POST /api/publicacoes/:id/voto
 *
 * Registra um voto. O enunciado exige que cada estudante vote apenas uma vez
 * por publicacao.
 *
 * ONDE A REGRA MORA: na restricao `UNIQUE (publicacao_id, usuario_id)` da
 * tabela `votos`. Este arquivo nao implementa a regra — ele traduz a recusa
 * do banco numa resposta HTTP decente.
 *
 * A diferenca importa. Se a regra vivesse aqui, numa consulta "ja votou?"
 * seguida de um INSERT, duas requisicoes simultaneas poderiam passar as duas
 * pela verificacao antes de qualquer uma gravar, e o voto duplo entraria. Com
 * a restricao no banco, a segunda falha sempre, independente de concorrencia.
 */

import { usuarioDaRequisicao } from "../../../_lib/sessao.js";

export async function onRequestPost({ request, env, params }) {
  const usuarioId = await usuarioDaRequisicao(request, env);
  if (!usuarioId) {
    return Response.json({ erro: "Entre com o Discord para votar." }, { status: 401 });
  }

  const publicacaoId = Number(params.id);
  if (!Number.isInteger(publicacaoId) || publicacaoId <= 0) {
    return Response.json({ erro: "Publicação inválida." }, { status: 400 });
  }

  const publicacao = await env.DB.prepare("SELECT id FROM publicacoes WHERE id = ?")
    .bind(publicacaoId)
    .first();
  if (!publicacao) {
    return Response.json({ erro: "Publicação não encontrada." }, { status: 404 });
  }

  try {
    await env.DB.prepare("INSERT INTO votos (publicacao_id, usuario_id) VALUES (?, ?)")
      .bind(publicacaoId, usuarioId)
      .run();
  } catch (erro) {
    // A mensagem do SQLite para violacao de unicidade. Traduzimos para 409
    // Conflict em vez de deixar vazar um 500: 500 diz "o servidor quebrou",
    // e aqui o servidor funcionou exatamente como projetado.
    const mensagem = String(erro?.message || "");
    if (/UNIQUE constraint failed/i.test(mensagem)) {
      return Response.json({ erro: "Você já votou nesta publicação." }, { status: 409 });
    }
    throw erro;
  }

  const { total } = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM votos WHERE publicacao_id = ?"
  )
    .bind(publicacaoId)
    .first();

  return Response.json({ publicacaoId, totalVotos: total });
}
