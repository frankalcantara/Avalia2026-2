export function isPositiveId(value) {
  return /^\d+$/.test(String(value ?? "")) && Number(value) > 0;
}

export function isDiscordUserId(value) {
  return /^\d{1,64}$/.test(String(value ?? ""));
}
