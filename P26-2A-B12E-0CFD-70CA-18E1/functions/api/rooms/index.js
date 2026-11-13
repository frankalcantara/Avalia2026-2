/**
 * /api/rooms
 *   GET  -> salas do organizador autenticado
 *   POST -> cria uma sala (código público único de 8 caracteres)
 */

import { novoId, randomCode } from "../../_lib/crypto.js";
import {
  buscarSalaPorCodigo,
  criarSala,
  listarSalasDoDono,
} from "../../_lib/db.js";
import {
  ErroHttp,
  json,
  lerJson,
  responderErro,
  verificarOrigem,
} from "../../_lib/http.js";
import { resumoSala } from "../../_lib/salas.js";
import { exigirSessao } from "../../_lib/sessao.js";
import { validarSala } from "../../_lib/validacao.js";

export async function onRequestGet({ request, env }) {
  try {
    const sessao = await exigirSessao(request, env);
    const salas = await listarSalasDoDono(env, sessao.user.userId);
    return json({ ok: true, salas: salas.map(resumoSala) });
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    verificarOrigem(request);
    const sessao = await exigirSessao(request, env);
    const dados = validarSala(await lerJson(request));

    let publicCode = null;
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const candidato = randomCode(8);
      if (!(await buscarSalaPorCodigo(env, candidato))) {
        publicCode = candidato;
        break;
      }
    }
    if (!publicCode) {
      throw new ErroHttp(503, "codigo_indisponivel", "Não foi possível gerar um código único. Tente novamente.");
    }

    await criarSala(env, {
      id: novoId(),
      publicCode,
      ownerUserId: sessao.user.userId,
      ...dados,
    });

    const sala = await buscarSalaPorCodigo(env, publicCode);
    return json({ ok: true, sala: resumoSala(sala) }, { status: 201 });
  } catch (erro) {
    return responderErro(erro);
  }
}
