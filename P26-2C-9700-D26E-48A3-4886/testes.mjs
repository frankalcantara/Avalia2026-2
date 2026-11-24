const BASE = process.argv[2] || "https://kudos-board-2c.pages.dev";
const post = (headers = {}, body = {}) =>
  fetch(BASE + "/api/kudos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const forgedPayload = Buffer.from(JSON.stringify({ userId: "544655104612237332", exp: 9999999999 })).toString("base64url");

const tests = [
  ["GET /api/badges responde 200 com selos", async () => {
    const r = await fetch(BASE + "/api/badges"); const j = await r.json();
    return r.status === 200 && j.badges.length > 0;
  }],
  ["GET /api/me sem login devolve user null", async () => {
    const j = await (await fetch(BASE + "/api/me")).json();
    return j.user === null;
  }],
  ["POST /api/kudos sem login devolve 401", async () => (await post({}, { to_id: "100000000000000001", badge: "codigo-limpo", message: "teste" })).status === 401],
  ["POST com cookie de sessão FORJADO devolve 401", async () =>
    (await post({ Cookie: `kudos_session=${forgedPayload}.assinaturafalsa` }, { to_id: "100000000000000001", badge: "codigo-limpo", message: "teste" })).status === 401],
  ["POST com Origin de outro site devolve 403", async () =>
    (await post({ Origin: "https://site-malicioso.example" }, { to_id: "100000000000000001", badge: "codigo-limpo", message: "teste" })).status === 403],
  ["GET /api/kudos?received=abc devolve 400", async () => (await fetch(BASE + "/api/kudos?received=abc")).status === 400],
  ["GET /api/kudos com tentativa de SQL injection devolve 400", async () =>
    (await fetch(BASE + "/api/kudos?sent=" + encodeURIComponent("1' OR '1'='1"))).status === 400],
  ["GET /api/kudos lista os cartões (200)", async () => {
    const r = await fetch(BASE + "/api/kudos"); const j = await r.json();
    return r.status === 200 && Array.isArray(j.kudos);
  }],
];

let falhas = 0;
for (const [nome, fn] of tests) {
  let ok = false;
  try { ok = await fn(); } catch (e) { ok = false; }
  if (!ok) falhas++;
  console.log((ok ? "PASSOU " : "FALHOU ") + "- " + nome);
}
console.log(`\n${tests.length - falhas}/${tests.length} testes passaram em ${BASE}`);
process.exit(falhas ? 1 : 0);
