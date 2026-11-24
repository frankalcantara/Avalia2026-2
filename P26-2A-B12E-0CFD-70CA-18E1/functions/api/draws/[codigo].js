/**
 * GET /api/draws/[codigo]
 * Ata pública por código SORT-XXXX-XXXX. Devolve tudo que o navegador precisa
 * para recalcular o hash e reproduzir o resultado sem confiar no servidor.
 */

import { buscarAtaPorCodigo, buscarCodigoPorHash } from "../../_lib/db.js";
import { ErroHttp, json, responderErro } from "../../_lib/http.js";
import { ataPublica } from "../../_lib/salas.js";
import { normalizarCodigoAta } from "../../_lib/validacao.js";

export async function onRequestGet({ env, params }) {
  try {
    const codigo = normalizarCodigoAta(params.codigo);
    const linha = await buscarAtaPorCodigo(env, codigo);
    if (!linha) {
      throw new ErroHttp(404, "ata_nao_encontrada", "Nenhuma ata foi encontrada com esse código.");
    }

    const prevDrawCode = await buscarCodigoPorHash(env, linha.prev_hash);
    return json({ ok: true, ata: ataPublica(linha, { prevDrawCode }) });
  } catch (erro) {
    return responderErro(erro);
  }
}
