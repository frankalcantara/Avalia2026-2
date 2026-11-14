import { json, methodAllowed, PROJECT_KEY, withErrors } from "../_lib.js";
export const onRequest = withErrors(async ({ request, env }) => {
  methodAllowed(request, ["GET"]);
  let database = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT user_id FROM discord_users LIMIT 1").first();
      await env.DB.prepare("SELECT user_id FROM curricula LIMIT 1").first();
      await env.DB.prepare("SELECT token_hash FROM sessions LIMIT 1").first();
      database = true;
    } catch { database = false; }
  }
  const discord = /^\d{5,25}$/.test(env.DISCORD_CLIENT_ID || "") && Boolean(env.DISCORD_CLIENT_SECRET);
  const sessions = typeof env.SESSION_SECRET === "string" && env.SESSION_SECRET.length >= 32;
  return json({ service: "portfolio-academico", project_key: PROJECT_KEY, database, discord, sessions, ready: database && discord && sessions });
});
