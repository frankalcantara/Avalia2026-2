/**
 * GET /api/draws
 * Últimas atas públicas — vitrine de auditoria da página inicial.
 */

import { listarAtasPublicas } from "../../_lib/db.js";
import { json, responderErro } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const limite = new URL(request.url).searchParams.get("limite");
    const atas = await listarAtasPublicas(env, limite);
    return json({
      ok: true,
      draws: atas.map((ata) => ({
        verificationCode: ata.verification_code,
        seq: ata.seq,
        mode: ata.mode,
        auditHash: ata.audit_hash,
        prevHash: ata.prev_hash ?? null,
        createdAt: ata.created_at,
        room: { code: ata.room_code, title: ata.room_title },
      })),
    });
  } catch (erro) {
    return responderErro(erro);
  }
}
