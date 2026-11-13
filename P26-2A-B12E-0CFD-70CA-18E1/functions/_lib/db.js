/**
 * Acesso ao Cloudflare D1.
 *
 * Todas as queries usam `prepare(...).bind(...)` para evitar SQL Injection.
 * Gravações compostas usam `env.DB.batch([...])`, que é transacional no D1.
 */

/** Timestamp único do projeto: ISO-8601 UTC com milissegundos. */
export function agoraIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Usuários e sessões
// ---------------------------------------------------------------------------

export async function salvarUsuarioDiscord(env, { userId, username, globalName, avatar }) {
  const agora = agoraIso();
  await env.DB.prepare(
    `INSERT INTO discord_users (user_id, username, global_name, avatar, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       global_name = excluded.global_name,
       avatar = excluded.avatar,
       updated_at = excluded.updated_at`
  )
    .bind(userId, username, globalName ?? null, avatar ?? null, agora, agora)
    .run();
}

export async function buscarUsuario(env, userId) {
  return env.DB.prepare(
    "SELECT user_id, username, global_name, avatar, created_at, updated_at FROM discord_users WHERE user_id = ?"
  )
    .bind(userId)
    .first();
}

export async function criarSessao(env, { tokenHash, userId, expiresAt, userAgent }) {
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(tokenHash, userId, agoraIso(), expiresAt, userAgent ?? null)
    .run();
}

export async function buscarSessao(env, tokenHash) {
  const linha = await env.DB.prepare(
    `SELECT s.token_hash, s.user_id, s.expires_at,
            u.username, u.global_name, u.avatar
     FROM sessions s
     JOIN discord_users u ON u.user_id = s.user_id
     WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first();

  if (!linha) return null;
  if (Date.parse(linha.expires_at) <= Date.now()) {
    await apagarSessao(env, tokenHash);
    return null;
  }
  return linha;
}

export async function apagarSessao(env, tokenHash) {
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function limparSessoesExpiradas(env) {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(agoraIso()).run();
}

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

export async function criarSala(env, { id, publicCode, ownerUserId, title, mode, groupSize, allowJoin }) {
  const agora = agoraIso();
  await env.DB.prepare(
    `INSERT INTO rooms (id, public_code, owner_user_id, title, mode, group_size, allow_join, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
  )
    .bind(id, publicCode, ownerUserId, title, mode, groupSize, allowJoin ? 1 : 0, agora, agora)
    .run();
}

export async function buscarSalaPorCodigo(env, publicCode) {
  return env.DB.prepare("SELECT * FROM rooms WHERE public_code = ?").bind(publicCode).first();
}

export async function buscarSalaPorId(env, id) {
  return env.DB.prepare("SELECT * FROM rooms WHERE id = ?").bind(id).first();
}

export async function listarSalasDoDono(env, ownerUserId) {
  const { results } = await env.DB.prepare(
    `SELECT r.*,
            (SELECT COUNT(*) FROM participants p WHERE p.room_id = r.id) AS participants_count,
            (SELECT COUNT(*) FROM draws d WHERE d.room_id = r.id) AS draws_count
     FROM rooms r
     WHERE r.owner_user_id = ?
     ORDER BY r.created_at DESC`
  )
    .bind(ownerUserId)
    .all();
  return results ?? [];
}

export async function atualizarSala(env, roomId, campos) {
  const permitidas = new Set(["title", "mode", "group_size", "allow_join"]);
  const sets = [];
  const valores = [];

  for (const [coluna, valor] of Object.entries(campos)) {
    if (!permitidas.has(coluna)) continue;
    sets.push(`${coluna} = ?`);
    valores.push(valor);
  }
  if (sets.length === 0) return;

  sets.push("updated_at = ?");
  valores.push(agoraIso(), roomId);
  await env.DB.prepare(`UPDATE rooms SET ${sets.join(", ")} WHERE id = ?`).bind(...valores).run();
}

export async function atualizarStatusSala(env, roomId, status) {
  await env.DB.prepare("UPDATE rooms SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, agoraIso(), roomId)
    .run();
}

export async function excluirSala(env, roomId) {
  await env.DB.prepare("DELETE FROM rooms WHERE id = ?").bind(roomId).run();
}

export async function salaTemAta(env, roomId) {
  const linha = await env.DB.prepare("SELECT 1 AS existe FROM draws WHERE room_id = ? LIMIT 1")
    .bind(roomId)
    .first();
  return Boolean(linha);
}

// ---------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------

export async function listarParticipantes(env, roomId) {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, display_name, source, joined_at
     FROM participants
     WHERE room_id = ?
     ORDER BY id`
  )
    .bind(roomId)
    .all();
  return results ?? [];
}

export async function contarParticipantes(env, roomId) {
  const linha = await env.DB.prepare("SELECT COUNT(*) AS total FROM participants WHERE room_id = ?")
    .bind(roomId)
    .first();
  return Number(linha?.total ?? 0);
}

export async function inserirParticipantesManuais(env, { roomId, nomes, addedByUserId }) {
  if (nomes.length === 0) return 0;
  const agora = agoraIso();
  const statements = nomes.map((nome) =>
    env.DB.prepare(
      `INSERT INTO participants (room_id, user_id, display_name, source, added_by_user_id, joined_at)
       VALUES (?, NULL, ?, 'manual', ?, ?)`
    ).bind(roomId, nome, addedByUserId, agora)
  );
  const resultados = await env.DB.batch(statements);
  return resultados.length;
}

export async function adicionarParticipanteDiscord(env, { roomId, userId, displayName, addedByUserId }) {
  const resultado = await env.DB.prepare(
    `INSERT INTO participants (room_id, user_id, display_name, source, added_by_user_id, joined_at)
     VALUES (?, ?, ?, 'discord', ?, ?)
     ON CONFLICT(room_id, user_id) DO NOTHING`
  )
    .bind(roomId, userId, displayName, addedByUserId, agoraIso())
    .run();
  return (resultado.meta?.changes ?? 0) > 0;
}

export async function removerParticipante(env, roomId, participantId) {
  const resultado = await env.DB.prepare("DELETE FROM participants WHERE room_id = ? AND id = ?")
    .bind(roomId, participantId)
    .run();
  return (resultado.meta?.changes ?? 0) > 0;
}

export async function removerParticipanteDoUsuario(env, roomId, userId) {
  const resultado = await env.DB.prepare(
    "DELETE FROM participants WHERE room_id = ? AND user_id = ?"
  )
    .bind(roomId, userId)
    .run();
  return (resultado.meta?.changes ?? 0) > 0;
}

export async function buscarParticipanteDoUsuario(env, roomId, userId) {
  return env.DB.prepare(
    "SELECT id, display_name, joined_at FROM participants WHERE room_id = ? AND user_id = ?"
  )
    .bind(roomId, userId)
    .first();
}

// ---------------------------------------------------------------------------
// Atas (draws + draw_entries)
// ---------------------------------------------------------------------------

export async function proximaSequencia(env, roomId) {
  const linha = await env.DB.prepare(
    "SELECT COALESCE(MAX(seq), 0) + 1 AS proxima FROM draws WHERE room_id = ?"
  )
    .bind(roomId)
    .first();
  return Number(linha?.proxima ?? 1);
}

export async function hashAnterior(env, roomId) {
  const linha = await env.DB.prepare(
    "SELECT audit_hash FROM draws WHERE room_id = ? ORDER BY seq DESC LIMIT 1"
  )
    .bind(roomId)
    .first();
  return linha?.audit_hash ?? null;
}

/**
 * Grava a ata e as entradas em uma única transação.
 * `ata` já vem com os JSONs serializados e o hash calculado.
 */
export async function gravarAta(env, { ata, entradas }) {
  const statements = [
    env.DB.prepare(
      `INSERT INTO draws (
         id, room_id, seq, mode, params_json, participants_json, result_json, swaps_json,
         algorithm, algorithm_version, audit_hash, prev_hash, verification_code,
         created_by_user_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ata.id,
      ata.roomId,
      ata.seq,
      ata.mode,
      ata.paramsJson,
      ata.participantsJson,
      ata.resultJson,
      ata.swapsJson,
      ata.algorithm,
      ata.algorithmVersion,
      ata.auditHash,
      ata.prevHash ?? null,
      ata.verificationCode,
      ata.createdByUserId,
      ata.createdAt
    ),
    ...entradas.map((entrada) =>
      env.DB.prepare(
        `INSERT INTO draw_entries (draw_id, position, group_index, participant_id, user_id, display_name)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        ata.id,
        entrada.position,
        entrada.groupIndex ?? null,
        entrada.participantId ?? null,
        entrada.userId ?? null,
        entrada.displayName
      )
    ),
  ];

  await env.DB.batch(statements);
}

async function anexarEntradas(env, linha) {
  const { results } = await env.DB.prepare(
    `SELECT position, group_index, participant_id, user_id, display_name
     FROM draw_entries
     WHERE draw_id = ?
     ORDER BY position`
  )
    .bind(linha.id)
    .all();
  return { ...linha, entries: results ?? [] };
}

export async function buscarAtaPorCodigo(env, codigo) {
  const linha = await env.DB.prepare("SELECT * FROM draws WHERE verification_code = ?")
    .bind(codigo)
    .first();
  if (!linha) return null;
  return anexarEntradas(env, linha);
}

export async function codigoAtaExiste(env, codigo) {
  const linha = await env.DB.prepare("SELECT 1 AS existe FROM draws WHERE verification_code = ?")
    .bind(codigo)
    .first();
  return Boolean(linha);
}

export async function buscarAtaPorId(env, id) {
  const linha = await env.DB.prepare("SELECT * FROM draws WHERE id = ?").bind(id).first();
  if (!linha) return null;
  return anexarEntradas(env, linha);
}

/** Código público da ata anterior (para exibir a corrente de hashes). */
export async function buscarCodigoPorHash(env, auditHash) {
  if (!auditHash) return null;
  const linha = await env.DB.prepare("SELECT verification_code FROM draws WHERE audit_hash = ?")
    .bind(auditHash)
    .first();
  return linha?.verification_code ?? null;
}

export async function listarAtasDaSala(env, roomId) {
  const { results } = await env.DB.prepare(
    `SELECT id, seq, mode, verification_code, audit_hash, prev_hash, created_at
     FROM draws
     WHERE room_id = ?
     ORDER BY seq DESC`
  )
    .bind(roomId)
    .all();
  return results ?? [];
}

/** Últimas atas públicas (painel de auditoria da página inicial). */
export async function listarAtasPublicas(env, limite = 20) {
  const { results } = await env.DB.prepare(
    `SELECT d.verification_code, d.seq, d.mode, d.audit_hash, d.prev_hash, d.created_at,
            r.public_code AS room_code, r.title AS room_title
     FROM draws d
     JOIN rooms r ON r.id = d.room_id
     ORDER BY d.created_at DESC
     LIMIT ?`
  )
    .bind(Math.min(Math.max(Number(limite) || 20, 1), 50))
    .all();
  return results ?? [];
}
