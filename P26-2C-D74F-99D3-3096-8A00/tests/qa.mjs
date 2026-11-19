// Agente de QA - testes contra produção. Uso:
//   node tests/qa.mjs https://achados-app.pages.dev
// Para os testes autenticados, copie o cookie "session" do navegador
// (F12 > Application > Cookies) e rode antes:
//   $env:QA_COOKIE="session=VALOR"
const base = process.argv[2] || "https://achados-app.pages.dev";
const cookie = process.env.QA_COOKIE || "";
const results = [];

async function call(method, path, body, auth = false) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`| ${name} | ${ok ? "PASSOU" : "FALHOU"} | ${detail} |`);
}

const valid = { type: "perdi", category: "garrafas", title: "QA teste", location: "Bloco A",
  event_date: "2026-01-10", description: "Descrição de teste com mais de dez caracteres." };

console.log(`# Relatório de QA - ${base}\n\n| Teste | Resultado | Detalhe |\n|---|---|---|`);

let r = await call("GET", "/api/items");
check("Listagem pública responde 200", r.status === 200, `status ${r.status}`);
r = await call("GET", "/api/me");
check("/api/me sem login retorna 401", r.status === 401, `status ${r.status}`);
r = await call("POST", "/api/items", valid);
check("Criar item sem login retorna 401", r.status === 401, `status ${r.status}`);
r = await call("POST", "/api/claims/1/close");
check("Encerrar caso sem login retorna 401", r.status === 401, `status ${r.status}`);
r = await call("GET", "/api/items?category=xyz");
check("Filtro com categoria inválida retorna 400", r.status === 400, `status ${r.status}`);

if (!cookie) {
  console.log("\nTestes autenticados pulados (QA_COOKIE não definido).");
} else {
  r = await call("POST", "/api/items", { ...valid, category: "xyz" }, true);
  check("Categoria inválida rejeitada (400)", r.status === 400, `status ${r.status}`);
  r = await call("POST", "/api/items", { ...valid, event_date: "2030-01-01" }, true);
  check("Data futura rejeitada (400)", r.status === 400, `status ${r.status}`);
  r = await call("POST", "/api/items", { ...valid, description: "curta" }, true);
  check("Descrição curta rejeitada (400)", r.status === 400, `status ${r.status}`);
  r = await call("POST", "/api/items", { ...valid, title: "<script>alert(1)</script>" }, true);
  check("Título com <script> é gravado como texto (201)", r.status === 201, `status ${r.status}`);
  const id = r.data.id;
  if (id) {
    const d = await call("GET", "/api/items/" + id);
    check("Título volta literal (sem execução; a UI usa textContent)",
      d.data.item?.title === "<script>alert(1)</script>");
    const c = await call("POST", `/api/items/${id}/claims`, { message: "teste" }, true);
    check("Reivindicar o próprio item retorna 403", c.status === 403, `status ${c.status}`);
  }
  r = await call("GET", "/api/items?type=perdi&category=garrafas");
  check("Filtros combinados retornam só perdi/garrafas",
    r.data.items?.every((i) => i.type === "perdi" && i.category === "garrafas"));
}

const fail = results.filter((x) => !x.ok).length;
console.log(`\n**Total: ${results.length - fail}/${results.length} passaram.**`);