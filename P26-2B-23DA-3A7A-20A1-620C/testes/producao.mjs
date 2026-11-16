// Testes de seguranca da API (Agente 3). Nao precisam de login nem de segredos.
// Uso: node testes/producao.mjs [URL_BASE]
const BASE = (process.argv[2] || "https://p26-2b-23da-3a7a-20a1-620c.pages.dev").replace(/\/$/, "");
const KEY = "P26-2B-23DA-3A7A-20A1-620C";

let passed = 0;
let failed = 0;

async function call(path, options = {}) {
  return fetch(BASE + path, { redirect: "manual", ...options });
}

function check(name, ok, detail) {
  if (ok) {
    passed++;
    console.log("  OK     " + name);
  } else {
    failed++;
    console.log("  FALHOU " + name + (detail ? "  -> " + detail : ""));
  }
}

async function main() {
  console.log("Alvo: " + BASE + "\n");

  console.log("Rotas protegidas sem sessao:");
  const anon = [
    ["GET", "/api/me"],
    ["GET", "/api/game/state"],
    ["POST", "/api/game/start"],
    ["POST", "/api/game/reveal"],
    ["POST", "/api/game/check"],
  ];
  for (const [method, path] of anon) {
    const r = await call(path, { method, body: method === "POST" ? "{}" : undefined });
    check(method + " " + path + " -> 401", r.status === 401, "status " + r.status);
  }

  console.log("\nCookie de sessao forjado:");
  const forged = { Cookie: "session=0000000000000000000000000000000000000000000000000000000000000000" };
  const f1 = await call("/api/me", { headers: forged });
  check("GET /api/me com cookie forjado -> 401", f1.status === 401, "status " + f1.status);
  const f2 = await call("/api/game/start", { method: "POST", headers: forged });
  check("POST /api/game/start com cookie forjado -> 401", f2.status === 401, "status " + f2.status);

  console.log("\nMetodo incorreto:");
  const m1 = await call("/api/auth/logout", { method: "GET" });
  check("GET /api/auth/logout nao devolve 200", m1.status === 404 || m1.status === 405, "status " + m1.status);

  console.log("\nOAuth2 (state anti-CSRF):");
  const o1 = await call("/api/auth/discord");
  const loc = o1.headers.get("location") || "";
  const cookies = typeof o1.headers.getSetCookie === "function" ? o1.headers.getSetCookie() : [];
  check("GET /api/auth/discord -> 302", o1.status === 302, "status " + o1.status);
  check("redireciona para discord.com", loc.startsWith("https://discord.com/"), loc.slice(0, 60));
  check("URL contem state", /[?&]state=[0-9a-f]{16,}/.test(loc));
  check("URL pede somente scope identify", /[?&]scope=identify(&|$)/.test(loc));
  const sc = cookies.find((c) => c.startsWith("oauth_state=")) || "";
  check("cookie oauth_state e HttpOnly", /HttpOnly/i.test(sc), sc ? "" : "cookie ausente");

  const o2 = await call("/api/auth/discord/callback?code=x&state=y");
  const loc2 = o2.headers.get("location") || "";
  check("callback sem cookie de state e rejeitado", o2.status === 302 && loc2.includes("auth_error=invalid_state"), "status " + o2.status + " " + loc2);

  console.log("\nFrontend:");
  const home = await call("/");
  const html = await home.text();
  check("pagina inicial responde 200", home.status === 200, "status " + home.status);
  check("rodape contem a Chave Unica", html.includes(KEY));
  check("sem frameworks externos (nenhum <script src> externo)", !/<script[^>]+src=["']https?:/i.test(html));

  console.log("\nResultado: " + passed + " ok, " + failed + " falha(s)");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("Erro ao executar os testes:", e.message);
  process.exit(2);
});