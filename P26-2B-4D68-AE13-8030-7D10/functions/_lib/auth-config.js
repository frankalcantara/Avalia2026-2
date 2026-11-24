export function getDiscordAuthConfig(env) {
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SESSION_SECRET } = env;
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    return null;
  }

  return {
    clientId: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    sessionSecret: SESSION_SECRET,
  };
}
