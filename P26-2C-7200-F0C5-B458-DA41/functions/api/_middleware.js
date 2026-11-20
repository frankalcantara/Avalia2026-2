/**
 * Middleware de /api/*: transforma erros inesperados (ex.: tabelas do D1 ainda não migradas)
 * em JSON 500 limpo, sem vazar stack trace para o cliente.
 */
export async function onRequest({ next }) {
  try {
    return await next();
  } catch (err) {
    const msg = String((err && err.message) || "");
    const hint = /no such table/i.test(msg)
      ? "Banco D1 sem tabelas: rode 'wrangler d1 migrations apply DB --remote'."
      : "Erro interno no servidor.";
    return new Response(JSON.stringify({ ok: false, error: hint }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
