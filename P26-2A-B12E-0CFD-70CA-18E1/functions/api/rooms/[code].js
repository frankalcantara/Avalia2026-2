/**
 * /api/rooms/[code]
 *   GET    -> detalhe público (participantes e atas)
 *   PATCH  -> organizador edita título, modo, tamanho de grupo ou entrada
 *   DELETE -> organizador exclui a sala (somente se ainda não houver ata)
 */

import {
  atualizarSala,
  buscarSalaPorCodigo,
  buscarUsuario,
  excluirSala,
  listarAtasDaSala,
  listarParticipantes,
  salaTemAta,
} from "../../_lib/db.js";
import {
  ErroHttp,
  json,
  lerJson,
  responderErro,
  verificarOrigem,
} from "../../_lib/http.js";
import { detalheSala, exigirDono } from "../../_lib/salas.js";
import { exigirSessao, sessaoAtual } from "../../_lib/sessao.js";
import { normalizarCodigoSala, validarSala } from "../../_lib/validacao.js";

async function carregarSala(env, params) {
  const sala = await buscarSalaPorCodigo(env, normalizarCodigoSala(params.code));
  if (!sala) throw new ErroHttp(404, "sala_nao_encontrada", "Sala não encontrada.");
  return sala;
}

export async function onRequestGet({ request, env, params }) {
  try {
    const sala = await carregarSala(env, params);
    const sessao = await sessaoAtual(request, env);
    const [participantes, atas, dono] = await Promise.all([
      listarParticipantes(env, sala.id),
      listarAtasDaSala(env, sala.id),
      buscarUsuario(env, sala.owner_user_id),
    ]);

    return json({
      ok: true,
      sala: detalheSala(sala, {
        participantes,
        atas,
        isOwner: sessao?.user.userId === sala.owner_user_id,
        isParticipant: Boolean(
          sessao && participantes.some((pessoa) => pessoa.user_id === sessao.user.userId)
        ),
        ownerName: dono ? dono.global_name || dono.username : null,
      }),
    });
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    verificarOrigem(request);
    const sala = await carregarSala(env, params);
    const sessao = await exigirSessao(request, env);
    exigirDono(sala, sessao);

    const body = await lerJson(request);
    const dados = validarSala({
      title: body.title ?? sala.title,
      mode: body.mode ?? sala.mode,
      groupSize: body.groupSize ?? body.group_size ?? sala.group_size,
      allowJoin: body.allowJoin ?? Boolean(sala.allow_join),
    });

    await atualizarSala(env, sala.id, {
      title: dados.title,
      mode: dados.mode,
      group_size: dados.groupSize,
      allow_join: dados.allowJoin ? 1 : 0,
    });

    const atualizada = await buscarSalaPorCodigo(env, sala.public_code);
    return json({
      ok: true,
      sala: {
        code: atualizada.public_code,
        title: atualizada.title,
        mode: atualizada.mode,
        groupSize: atualizada.group_size,
        allowJoin: Boolean(atualizada.allow_join),
        status: atualizada.status,
      },
    });
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    verificarOrigem(request);
    const sala = await carregarSala(env, params);
    const sessao = await exigirSessao(request, env);
    exigirDono(sala, sessao);

    if (await salaTemAta(env, sala.id)) {
      throw new ErroHttp(
        409,
        "sala_com_ata",
        "Esta sala já possui ata registrada e não pode ser excluída. Crie outra sala para um novo sorteio."
      );
    }

    await excluirSala(env, sala.id);
    return json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
