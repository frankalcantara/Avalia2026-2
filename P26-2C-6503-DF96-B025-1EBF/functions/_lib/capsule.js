/** Monta o DTO de cápsula enviado ao navegador (regra de bloqueio temporal). */
/** Monta o objeto enviado ao navegador. Para cápsulas bloqueadas, NÃO inclui `content`. */
export function buildCapsuleDto(row, nowMs, viewerId) {
  const unlockMs = Date.parse(row.unlock_date);
  const locked = unlockMs > nowMs;
  const dto = {
    id: row.id,
    title: row.title,
    audience: row.audience,
    unlock_date: row.unlock_date,
    created_at: row.created_at,
    locked,
    is_mine: viewerId !== null && row.user_id === viewerId,
    author: { name: row.username, avatar: row.avatar },
  };
  if (locked) {
    dto.seconds_remaining = Math.ceil((unlockMs - nowMs) / 1000);
  } else {
    dto.content = row.content;
  }
  return dto;
}
