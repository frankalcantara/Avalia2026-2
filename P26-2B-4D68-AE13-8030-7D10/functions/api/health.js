import { json } from "../_lib/http.js";

// Diagnóstico do deploy: confirma que o banco responde, sem exigir login.
export async function onRequestGet({ env }) {
  const started = Date.now();
  const checks = { database: "missing" };

  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      checks.database = "ok";
    } catch (error) {
      checks.database = "error";
      checks.databaseError = error?.message || String(error);
    }
  }

  const healthy = checks.database === "ok";
  return json({
    ok: healthy,
    status: healthy ? "ok" : "degraded",
    checks,
    latencyMs: Date.now() - started,
    time: new Date().toISOString(),
  }, healthy ? 200 : 503, { "Cache-Control": "no-store" });
}
