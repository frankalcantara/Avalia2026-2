// Testes de API ponta a ponta contra o app LOCAL (wrangler pages dev + D1 local semeado).
// Casos derivados de docs/ESPECIFICACAO.md (seções 3, 4, 5 e 6), não do código.
// Rodar tudo (prepara banco, sobe e derruba servidor): npm run test:api
// Só os testes, com servidor já no ar e banco recém-preparado: BASE_URL=http://localhost:8788 node --test tests/api.test.mjs
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { ITENS_SEMENTE, TAG, USUARIOS } from "./fixtures.mjs";

const BASE = process.env.BASE_URL || "http://localhost:8788";
const ORIGEM = new URL(BASE).origin;
const { A, B, C, D, E, F, G } = USUARIOS;

// ---------- utilitários ----------
async function chamar(metodo, caminho, { usuario, corpo, origem = ORIGEM, cabecalhos = {}, bruto, redirect } = {}) {
  const headers = { ...cabecalhos };
  if (usuario) headers.Cookie = `sessao=${usuario.token}`;
  if (origem && metodo !== "GET") headers.Origin = origem;
  let body;
  if (bruto !== undefined) body = bruto;
  else if (corpo !== undefined) {
    body = JSON.stringify(corpo);
    if (!("Content-Type" in headers)) headers["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE + caminho, { method: metodo, headers, body, redirect: redirect || "follow" });
  const texto = await res.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* não-JSON */
  }
  return { status: res.status, headers: res.headers, texto, json };
}
const get = (c, o) => chamar("GET", c, o);
const post = (c, o) => chamar("POST", c, o);
const del = (c, o) => chamar("DELETE", c, o);

function hojeSP(deslocDias = 0) {
  const d = new Date(Date.now() + deslocDias * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function umAnoAntesMenos(dias) {
  const [a, m, d] = hojeSP().split("-").map(Number);
  const dt = new Date(Date.UTC(a - 1, m - 1, d) - dias * 86400000);
  return dt.toISOString().slice(0, 10);
}

let seq = 0;
function itemValido(extra = {}) {
  seq += 1;
  return {
    tipo: "encontrei",
    categoria: "eletronicos",
    titulo: `Item de teste ${seq}`,
    descricao: `Descrição do item de teste número ${seq}.`,
    local: "Bloco C, sala 12",
    data_ocorrencia: hojeSP(-1),
    ...extra,
  };
}
async function criarItem(usuario, extra) {
  const r = await post("/api/itens", { usuario, corpo: itemValido(extra) });
  assert.equal(r.status, 201, `criar item: ${r.status} ${r.texto}`);
  return r.json.item;
}
async function reivindicar(usuario, itemId, mensagem = "Esse item é meu, tem minha etiqueta.") {
  return post(`/api/itens/${itemId}/reivindicacoes`, { usuario, corpo: { mensagem } });
}
function assertErro(r, status, msg = "") {
  assert.equal(r.status, status, `${msg} esperado ${status}, obtido ${r.status}: ${r.texto}`);
  assert.ok(r.json && typeof r.json.erro === "string" && typeof r.json.mensagem === "string", `formato de erro {erro, mensagem}: ${r.texto}`);
}
const ITEM_CAMPOS = ["autor", "categoria", "criado_em", "data_ocorrencia", "descricao", "encerrado_em", "id", "local", "status", "tipo", "titulo", "total_reivindicacoes"];

before(async () => {
  const r = await fetch(BASE + "/api/status").catch((e) => ({ erro: e }));
  if (r.erro) throw new Error(`Servidor fora do ar em ${BASE}. Use npm run test:api.`);
});

// =====================================================================
describe("saúde e sessão (seção 3)", () => {
  test("GET /api/status → 200, d1 ok, OAuth configurado", async () => {
    const r = await get("/api/status");
    assert.equal(r.status, 200);
    assert.equal(r.json.d1, true);
    assert.equal(r.json.oauth_configurado, true);
  });

  test("GET /api/me sem sessão → 200 { usuario: null }", async () => {
    const r = await get("/api/me");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { usuario: null });
  });

  test("GET /api/me com sessão → dados do usuário (sem campos extras)", async () => {
    const r = await get("/api/me", { usuario: A });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json.usuario).sort(), ["avatar_url", "nome_exibicao", "user_id", "username"]);
    assert.equal(r.json.usuario.user_id, A.user_id);
    assert.equal(r.json.usuario.username, A.username);
  });

  test("sessão expirada, token inexistente e cookie malformado → usuario null", async () => {
    assert.equal((await get("/api/me", { usuario: G })).json.usuario, null);
    assert.equal((await get("/api/me", { cabecalhos: { Cookie: "sessao=tokenQueNaoExisteNoBanco123" } })).json.usuario, null);
    assert.equal((await get("/api/me", { cabecalhos: { Cookie: "sessao=' OR 1=1 --" } })).json.usuario, null);
    // O hash nunca serve como token: mandar o hash no cookie não autentica.
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(A.token).digest("hex");
    assert.equal((await get("/api/me", { cabecalhos: { Cookie: `sessao=${hash}` } })).json.usuario, null);
  });

  test("cookie de sessão junto de outros cookies é reconhecido", async () => {
    const r = await get("/api/me", { cabecalhos: { Cookie: `tema=escuro; sessao=${A.token}; outro=1` } });
    assert.equal(r.json.usuario?.user_id, A.user_id);
  });

  test("GET /api/auth/discord → 302 para discord.com com scope=identify e cookie oauth_state seguro", async () => {
    const r = await get("/api/auth/discord", { redirect: "manual" });
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get("location"));
    assert.equal(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
    assert.equal(loc.searchParams.get("scope"), "identify");
    assert.equal(loc.searchParams.get("response_type"), "code");
    const state = loc.searchParams.get("state");
    assert.ok(state && state.length >= 16, "state aleatório");
    const ck = r.headers.get("set-cookie") || "";
    assert.match(ck, new RegExp(`oauth_state=${state}`));
    for (const atr of ["HttpOnly", "Secure", "SameSite=Lax"]) assert.match(ck, new RegExp(atr, "i"), atr);
    assert.match(ck, /Max-Age=600/);
    // Dois logins geram states diferentes.
    const r2 = await get("/api/auth/discord", { redirect: "manual" });
    assert.notEqual(new URL(r2.headers.get("location")).searchParams.get("state"), state);
  });

  test("callback com state diferente do cookie → /?erro_login=state_invalido (sem sessão)", async () => {
    const r = await get("/api/auth/discord/callback?code=abc&state=stateErrado123456", {
      redirect: "manual",
      cabecalhos: { Cookie: "oauth_state=outroStateQualquer123" },
    });
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location"), /\/\?erro_login=state_invalido$/);
    assert.doesNotMatch(r.headers.get("set-cookie") || "", /sessao=[A-Za-z0-9_-]/);
    assert.match(r.headers.get("set-cookie") || "", /oauth_state=;[^,]*Max-Age=0/, "oauth_state sempre expirado no callback (6.10)");
  });

  test("callback sem cookie de state → state_invalido; com error=access_denied → negado", async () => {
    const r = await get("/api/auth/discord/callback?code=abc&state=x", { redirect: "manual" });
    assert.match(r.headers.get("location"), /erro_login=state_invalido/);
    const r2 = await get("/api/auth/discord/callback?error=access_denied", { redirect: "manual" });
    assert.match(r2.headers.get("location"), /erro_login=negado/);
  });

  test("POST /api/auth/logout apaga a sessão no D1 e expira o cookie", async () => {
    assert.equal((await get("/api/me", { usuario: F })).json.usuario.user_id, F.user_id);
    const r = await post("/api/auth/logout", { usuario: F });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    assert.match(r.headers.get("set-cookie") || "", /sessao=;.*Max-Age=0/);
    assert.equal((await get("/api/me", { usuario: F })).json.usuario, null, "token antigo não pode mais valer");
  });

  test("logout sem Origin → 403 (CSRF)", async () => {
    const r = await post("/api/auth/logout", { usuario: A, origem: null });
    assertErro(r, 403);
    assert.equal((await get("/api/me", { usuario: A })).json.usuario.user_id, A.user_id, "sessão de A continua válida");
  });
});

// =====================================================================
describe("POST /api/itens — criação e validação (4.2 e 5)", () => {
  test("sem sessão → 401", async () => {
    assertErro(await post("/api/itens", { corpo: itemValido() }), 401);
  });

  test("sessão expirada → 401", async () => {
    assertErro(await post("/api/itens", { usuario: G, corpo: itemValido() }), 401);
  });

  test("item válido → 201 { item } com formato do contrato, status aberto e autor = sessão", async () => {
    const corpo = itemValido({ titulo: "  Mochila\tpreta  ", tipo: "perdi", categoria: "vestuario" });
    const r = await post("/api/itens", { usuario: A, corpo });
    assert.equal(r.status, 201, r.texto);
    const it = r.json.item;
    assert.deepEqual(Object.keys(it).sort(), ITEM_CAMPOS);
    assert.equal(it.status, "aberto");
    assert.equal(it.titulo, "Mochila preta", "trim + \\t vira espaço");
    assert.equal(it.tipo, "perdi");
    assert.equal(it.encerrado_em, null);
    assert.equal(it.total_reivindicacoes, 0);
    assert.equal(it.autor.user_id, A.user_id);
    assert.equal(it.autor.username, A.username);
    const det = await get(`/api/itens/${it.id}`);
    assert.equal(det.status, 200);
    assert.equal(det.json.item.titulo, "Mochila preta");
  });

  test("campos extras são ignorados (não dá para forjar autor, status nem id)", async () => {
    const r = await post("/api/itens", {
      usuario: A,
      corpo: itemValido({ status: "encerrado", autor_id: B.user_id, autor: { user_id: B.user_id }, id: 1, encerrado_em: "2026-01-01" }),
    });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.item.status, "aberto");
    assert.equal(r.json.item.autor.user_id, A.user_id);
    assert.equal(r.json.item.encerrado_em, null);
    assert.notEqual(r.json.item.id, 1);
  });

  test("Content-Type 'application/json; charset=utf-8' é aceito", async () => {
    const r = await post("/api/itens", {
      usuario: A,
      corpo: itemValido(),
      cabecalhos: { "Content-Type": "application/json; charset=utf-8" },
    });
    assert.equal(r.status, 201, r.texto);
  });

  const invalidos = {
    "titulo com 2 chars": { titulo: "ab" },
    "titulo com 81 chars": { titulo: "a".repeat(81) },
    "titulo só com controles/bidi (vira vazio)": { titulo: "\u0000\u0001‮" },
    "descricao com 9 chars": { descricao: "a".repeat(9) },
    "descricao com 1001 chars": { descricao: "a".repeat(1001) },
    "local com 2 chars": { local: "ab" },
    "local com 121 chars": { local: "a".repeat(121) },
    "tipo inválido": { tipo: "achei" },
    "categoria fora da lista": { categoria: "livros" },
    "data futura (amanhã + 1 em SP)": { data_ocorrencia: hojeSP(2) },
    "data anterior a 1 ano": { data_ocorrencia: umAnoAntesMenos(2) },
    "data inexistente": { data_ocorrencia: "2026-02-30" },
    "data em outro formato": { data_ocorrencia: "09/11/2026" },
    "titulo numérico": { titulo: 12345 },
  };
  for (const [nome, extra] of Object.entries(invalidos)) {
    test(`inválido: ${nome} → 400 com campos`, async () => {
      const r = await post("/api/itens", { usuario: A, corpo: itemValido(extra) });
      assertErro(r, 400, nome);
      const campo = Object.keys(extra)[0];
      assert.ok(r.json.campos && r.json.campos[campo], `campos.${campo} esperado: ${r.texto}`);
    });
  }

  test("data de hoje (SP) e exatamente 1 ano atrás são aceitas", async () => {
    // Usa o usuário B para não estourar o limite/hora de A.
    assert.equal((await post("/api/itens", { usuario: B, corpo: itemValido({ data_ocorrencia: hojeSP() }) })).status, 201);
    assert.equal((await post("/api/itens", { usuario: B, corpo: itemValido({ data_ocorrencia: umAnoAntesMenos(0) }) })).status, 201);
  });

  test("Origin de outro site → 403", async () => {
    assertErro(await post("/api/itens", { usuario: A, corpo: itemValido(), origem: "https://evil.example" }), 403);
  });
  test("sem Origin → 403", async () => {
    assertErro(await post("/api/itens", { usuario: A, corpo: itemValido(), origem: null }), 403);
  });
  test("Origin 'null' → 403", async () => {
    assertErro(await post("/api/itens", { usuario: A, corpo: itemValido(), origem: "null" }), 403);
  });
  test("sem JSON (text/plain) → 415", async () => {
    assertErro(
      await post("/api/itens", { usuario: A, bruto: JSON.stringify(itemValido()), cabecalhos: { "Content-Type": "text/plain" } }),
      415,
    );
  });
  test("form-urlencoded → 415", async () => {
    assertErro(
      await post("/api/itens", { usuario: A, bruto: "tipo=perdi", cabecalhos: { "Content-Type": "application/x-www-form-urlencoded" } }),
      415,
    );
  });
  test("JSON malformado → 400", async () => {
    assertErro(await post("/api/itens", { usuario: A, bruto: "{tipo:", cabecalhos: { "Content-Type": "application/json" } }), 400);
  });
  test("JSON que não é objeto (array) → 400", async () => {
    assertErro(await post("/api/itens", { usuario: A, bruto: "[1,2]", cabecalhos: { "Content-Type": "application/json" } }), 400);
  });
  test("Origin parecido (sufixo/porta diferente) → 403", async () => {
    const u = new URL(BASE);
    // Obs.: a variante "https://<mesmo host>" não é testável localmente — o proxy do `wrangler pages dev`
    // reescreve Origin https://localhost:PORTA para http://localhost:PORTA antes de chegar ao worker
    // (sondado com um worker de eco; ver docs/RELATORIO-TESTES.md).
    for (const o of [`${ORIGEM}.evil.example`, `${u.protocol}//${u.hostname}:1`, `${u.protocol}//127.0.0.1:${u.port}`]) {
      assertErro(await post("/api/itens", { usuario: A, corpo: itemValido(), origem: o }), 403, o);
    }
  });
  test("JSON vazio com Content-Type JSON → 400", async () => {
    assertErro(await post("/api/itens", { usuario: A, bruto: "", cabecalhos: { "Content-Type": "application/json" } }), 400);
  });
  test("corpo de exatamente 8192 bytes é aceito (limite inclusivo)", async () => {
    const corpo = itemValido({ lixo: "" });
    const tam = Buffer.byteLength(JSON.stringify(corpo));
    corpo.lixo = "x".repeat(8192 - tam);
    const bruto = JSON.stringify(corpo);
    assert.equal(Buffer.byteLength(bruto), 8192);
    const r = await post("/api/itens", { usuario: B, bruto, cabecalhos: { "Content-Type": "application/json" } });
    assert.equal(r.status, 201, r.texto);
  });
  test("corpo > 8 KB SEM Content-Length (chunked) → 413", async () => {
    const dados = new TextEncoder().encode(JSON.stringify(itemValido({ lixo: "y".repeat(9000) })));
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < dados.length; i += 1000) c.enqueue(dados.slice(i, i + 1000));
        c.close();
      },
    });
    const res = await fetch(BASE + "/api/itens", {
      method: "POST",
      duplex: "half",
      body: stream,
      headers: { Cookie: `sessao=${B.token}`, Origin: ORIGEM, "Content-Type": "application/json" },
    });
    const texto = await res.text();
    assert.equal(res.status, 413, texto);
  });
  test("corpo > 8 KB → 413 corpo_grande (6.1)", async () => {
    const r = await post("/api/itens", { usuario: A, corpo: itemValido({ lixo: "x".repeat(9000) }) });
    assertErro(r, 413);
    assert.equal(r.json.erro, "corpo_grande");
  });
});

// =====================================================================
describe("GET /api/itens — filtros cruzados (4.1 e 6.5)", () => {
  const sementeAbertos = ITENS_SEMENTE.filter((i) => i[7] !== "encerrado").length; // 5

  test("formato da resposta e do Item", async () => {
    const r = await get(`/api/itens?q=${TAG}`);
    assert.equal(r.status, 200);
    for (const k of ["itens", "total", "pagina", "por_pagina", "contagens"]) assert.ok(k in r.json, k);
    assert.equal(r.json.pagina, 1);
    assert.equal(r.json.por_pagina, 12);
    assert.deepEqual(Object.keys(r.json.itens[0]).sort(), ITEM_CAMPOS);
    assert.deepEqual(Object.keys(r.json.itens[0].autor).sort(), ["avatar_url", "nome_exibicao", "user_id", "username"]);
  });

  test("padrão exclui encerrado; status=todos inclui", async () => {
    const padrao = await get(`/api/itens?q=${TAG}`);
    assert.equal(padrao.json.total, sementeAbertos);
    assert.ok(padrao.json.itens.every((i) => i.status !== "encerrado"));
    const todos = await get(`/api/itens?q=${TAG}&status=todos`);
    assert.equal(todos.json.total, ITENS_SEMENTE.length);
    const enc = await get(`/api/itens?q=${TAG}&status=encerrado`);
    assert.equal(enc.json.total, 1);
    assert.equal(enc.json.itens[0].titulo, "Carteira de estudante");
  });

  test("tipo + categoria + q retornam só o que bate nos três", async () => {
    const r = await get("/api/itens?tipo=perdi&categoria=garrafas&q=azul");
    assert.equal(r.status, 200);
    assert.ok(r.json.itens.length >= 1);
    for (const i of r.json.itens) {
      assert.equal(i.tipo, "perdi");
      assert.equal(i.categoria, "garrafas");
      assert.match(`${i.titulo} ${i.descricao} ${i.local}`.toLowerCase(), /azul/);
    }
    const s = await get(`/api/itens?tipo=perdi&categoria=garrafas&q=${TAG}`);
    assert.deepEqual(s.json.itens.map((i) => i.titulo).sort(), ["Garrafa azul térmica", "Garrafa verde"]);
  });

  test("q busca em título, descrição e local", async () => {
    assert.equal((await get("/api/itens?q=Biblioteca central")).json.itens[0]?.titulo, "Garrafa azul térmica", "local");
    assert.equal((await get("/api/itens?q=squeeze")).json.itens[0]?.titulo, "Garrafa verde", "descrição");
    assert.equal((await get("/api/itens?q=bluetooth")).json.itens[0]?.titulo, "Fone azul bluetooth", "título");
  });

  test("filtro local (contém)", async () => {
    const r = await get(`/api/itens?q=${TAG}&local=cantina`);
    assert.deepEqual(r.json.itens.map((i) => i.titulo), ["Garrafa azul de plástico"]);
  });

  test("contagens aplicam os filtros antes da paginação", async () => {
    const r = await get(`/api/itens?q=${TAG}&por_pagina=1`);
    assert.equal(r.json.itens.length, 1);
    assert.equal(r.json.total, 5);
    assert.deepEqual(r.json.contagens.por_categoria, { eletronicos: 1, documentos: 0, garrafas: 3, vestuario: 1 });
    assert.deepEqual(r.json.contagens.por_tipo, { perdi: 4, encontrei: 1 });
    const t = await get(`/api/itens?q=${TAG}&tipo=perdi`);
    assert.deepEqual(t.json.contagens.por_tipo, { perdi: 4, encontrei: 0 });
  });

  test("de/ate sobre data_ocorrencia", async () => {
    const todos = (await get(`/api/itens?q=${TAG}`)).json.itens;
    const datas = todos.map((i) => i.data_ocorrencia).sort();
    const de = datas[1];
    const ate = datas[3];
    const r = await get(`/api/itens?q=${TAG}&de=${de}&ate=${ate}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.itens.length >= 1);
    for (const i of r.json.itens) assert.ok(i.data_ocorrencia >= de && i.data_ocorrencia <= ate, i.data_ocorrencia);
    assert.equal(r.json.total, datas.filter((d) => d >= de && d <= ate).length);
  });

  test("paginação e ordem", async () => {
    const p1 = await get(`/api/itens?q=${TAG}&por_pagina=2&pagina=1`);
    const p3 = await get(`/api/itens?q=${TAG}&por_pagina=2&pagina=3`);
    assert.equal(p1.json.itens.length, 2);
    assert.equal(p3.json.itens.length, 1);
    assert.equal(p3.json.pagina, 3);
    assert.equal(p3.json.total, 5);
    const rec = (await get(`/api/itens?q=${TAG}&ordem=recentes`)).json.itens.map((i) => i.id);
    const ant = (await get(`/api/itens?q=${TAG}&ordem=antigos`)).json.itens.map((i) => i.id);
    assert.deepEqual(ant, [...rec].reverse());
    assert.equal(rec[0], Math.max(...rec), "recentes primeiro (padrão)");
  });

  test("pagina além do fim, dentro do teto (6.5: 1..10000) → 200 com lista vazia", async () => {
    for (const p of [99, 10000]) {
      const r = await get(`/api/itens?q=${TAG}&pagina=${p}`);
      assert.equal(r.status, 200, `pagina=${p}: ${r.texto}`);
      assert.deepEqual(r.json.itens, []);
      assert.equal(r.json.total, 5);
    }
  });

  test("tetos de entrada (6.5): pagina=10001 → 400; local com 121 chars → 400", async () => {
    assertErro(await get(`/api/itens?pagina=10001`), 400, "pagina=10001");
    assertErro(await get(`/api/itens?local=${"a".repeat(121)}`), 400, "local 121");
  });

  test("q e local no tamanho máximo do contrato não quebram (200, nunca 500)", async () => {
    // q até 60 chars (4.1) e local até 120 (6.5) são VÁLIDOS: devem responder 200 (com 0 itens aqui).
    const casos = {
      "q 49 chars": `q=${"a".repeat(49)}`,
      "q 60 chars": `q=${"a".repeat(60)}`,
      "q 30 'ã' (60 bytes)": `q=${encodeURIComponent("ã".repeat(30))}`,
      "q 30 '%' (escapados)": `q=${encodeURIComponent("%".repeat(30))}`,
      "local 120 chars": `local=${"a".repeat(120)}`,
    };
    const obtidos = {};
    for (const [nome, qs] of Object.entries(casos)) obtidos[nome] = (await get(`/api/itens?${qs}`)).status;
    assert.deepEqual(obtidos, Object.fromEntries(Object.keys(casos).map((k) => [k, 200])));
  });

  test("valor vazio = ausente", async () => {
    const r = await get(`/api/itens?q=${TAG}&tipo=&categoria=&status=`);
    assert.equal(r.status, 200);
    assert.equal(r.json.total, 5);
  });

  const filtrosInvalidos = [
    "tipo=achei",
    "categoria=livros",
    "status=perdido",
    "ordem=aleatoria",
    "pagina=0",
    "pagina=abc",
    "por_pagina=51",
    "por_pagina=0",
    "de=2026-02-30",
    "ate=ontem",
    "de=2026-11-09&ate=2026-11-01",
    `q=${"a".repeat(61)}`,
    "tipo=perdi' OR '1'='1",
  ];
  for (const f of filtrosInvalidos) {
    test(`filtro inválido → 400: ${f.slice(0, 40)}`, async () => {
      assertErro(await get(`/api/itens?${f.replace(/'/g, "%27").replace(/ /g, "%20")}`), 400, f);
    });
  }

  test("meus=1 sem login → 401; com login → só itens do usuário", async () => {
    assertErro(await get("/api/itens?meus=1"), 401);
    const r = await get("/api/itens?meus=1&status=todos&por_pagina=50", { usuario: A });
    assert.equal(r.status, 200);
    assert.ok(r.json.total >= 1);
    assert.ok(r.json.itens.every((i) => i.autor.user_id === A.user_id));
  });

  test("SQL injection na busca não quebra nem vaza (200 com 0 itens ou 400)", async () => {
    for (const q of ["' OR 1=1 --", `${TAG}' OR '1'='1`, "'; DROP TABLE itens; --", "\" OR \"\"=\"", "1) UNION SELECT * FROM sessoes --"]) {
      const r = await get(`/api/itens?q=${encodeURIComponent(q)}&status=todos`);
      assert.ok(r.status === 200 || r.status === 400, `${q}: ${r.status}`);
      if (r.status === 200) assert.equal(r.json.total, 0, `${q} vazou ${r.json.total} itens`);
      assert.doesNotMatch(r.texto, /token_hash|SQLITE|syntax/i);
    }
    const ainda = await get(`/api/itens?q=${TAG}&status=todos`);
    assert.equal(ainda.json.total, ITENS_SEMENTE.length, "tabela itens intacta");
  });

  test("curingas são literais: q=%, q=_cinza, q=100%, q=_; q=30×ã → 200", async () => {
    const pct = await get(`/api/itens?q=${encodeURIComponent("%")}&status=todos`);
    assert.deepEqual(pct.json.itens.map((i) => i.titulo), ["Casaco 100% lã"]);
    const und = await get(`/api/itens?q=_cinza&status=todos`);
    assert.deepEqual(und.json.itens.map((i) => i.titulo), ["Casaco 100% lã"], "não pode casar 'fonecinza'");
    const cem = await get(`/api/itens?q=${encodeURIComponent("100%")}&status=todos`);
    assert.deepEqual(cem.json.itens.map((i) => i.titulo), ["Casaco 100% lã"], "q=100% só casa '100%' literal");
    const sub = await get(`/api/itens?q=_&status=todos`);
    assert.equal(sub.status, 200);
    assert.deepEqual(sub.json.itens.map((i) => i.titulo), ["Casaco 100% lã"], "q=_ é literal (só 'casaco_cinza' tem _)");
    const ac = await get(`/api/itens?q=${encodeURIComponent("ã".repeat(30))}&status=todos`);
    assert.equal(ac.status, 200, ac.texto);
    assert.equal(ac.json.total, 0);
  });
});

// =====================================================================
describe("detalhe, rotas e métodos (6.1, 6.3, 6.6)", () => {
  test("GET /api/itens/abc → 400; inexistente → 404", async () => {
    assertErro(await get("/api/itens/abc"), 400);
    assertErro(await get("/api/itens/999999"), 404);
  });
  test("GET /api/itens/:id anônimo → item, reivindicacoes [] e permissoes falsas", async () => {
    const id = (await get(`/api/itens?q=${TAG}`)).json.itens[0].id;
    const r = await get(`/api/itens/${id}`);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ["item", "permissoes", "reivindicacoes"]);
    assert.deepEqual(r.json.reivindicacoes, []);
    assert.deepEqual(r.json.permissoes, { eh_autor: false, pode_reivindicar: false, pode_encerrar: false, pode_apagar: false });
  });
  test("rota inexistente da API → 404 JSON", async () => {
    const r = await get("/api/nao-existe");
    assertErro(r, 404);
    assert.match(r.headers.get("content-type") || "", /application\/json/);
  });
  test("método errado → 405", async () => {
    const r = await chamar("PUT", "/api/itens", { usuario: A, corpo: itemValido() });
    assertErro(r, 405);
    assertErro(await chamar("PATCH", "/api/me", { usuario: A }), 405);
  });
  test("POST /api/reivindicacoes/:id/acao-desconhecida → 404", async () => {
    assertErro(await post("/api/reivindicacoes/1/apagar", { usuario: A }), 404);
  });
  test("GET /api/reivindicacoes sem login → 401", async () => {
    assertErro(await get("/api/reivindicacoes"), 401);
  });
  test("reivindicar item inexistente → 404; id inválido → 400", async () => {
    assertErro(await reivindicar(B, 999999), 404);
    assertErro(await reivindicar(B, "abc"), 400);
  });
});

// =====================================================================
describe("fluxo de reivindicação, contatos e encerramento (4.3)", () => {
  let item; // de A
  let rB; // reivindicação de B
  let rC; // reivindicação de C

  test("A cria item 'encontrei'", async () => {
    item = await criarItem(A, { titulo: "Notebook cinza", categoria: "eletronicos" });
    const det = await get(`/api/itens/${item.id}`, { usuario: A });
    assert.equal(det.json.permissoes.eh_autor, true);
    assert.equal(det.json.permissoes.pode_reivindicar, false);
    assert.equal(det.json.permissoes.pode_apagar, true);
  });

  test("reivindicar sem login → 401", async () => {
    assertErro(await reivindicar(null, item.id), 401);
  });

  test("autor reivindica o próprio item → 403", async () => {
    assertErro(await reivindicar(A, item.id), 403);
  });

  test("mensagem com 9 ou 501 chars → 400", async () => {
    assertErro(await reivindicar(B, item.id, "a".repeat(9)), 400);
    assertErro(await reivindicar(B, item.id, "a".repeat(501)), 400);
  });

  test("B reivindica → 201 com contatos das duas pontas gravados", async () => {
    const r = await reivindicar(B, item.id);
    assert.equal(r.status, 201, r.texto);
    rB = r.json.reivindicacao;
    assert.equal(rB.status, "pendente");
    assert.equal(rB.contato_autor, A.username);
    assert.equal(rB.contato_reivindicante, B.username);
  });

  test("B reivindica de novo → 409 (uma ativa por usuário)", async () => {
    assertErro(await reivindicar(B, item.id), 409);
  });

  test("C (outro usuário) reivindica → 201", async () => {
    const r = await reivindicar(C, item.id, "Acho que é o meu notebook, tem adesivo.");
    assert.equal(r.status, 201, r.texto);
    rC = r.json.reivindicacao;
  });

  test("total_reivindicacoes conta as duas", async () => {
    assert.equal((await get(`/api/itens/${item.id}`)).json.item.total_reivindicacoes, 2);
  });

  test("contatos: autor vê as duas com contatos; cada reivindicante só a sua", async () => {
    const pa = await get(`/api/itens/${item.id}`, { usuario: A });
    assert.equal(pa.json.reivindicacoes.length, 2);
    for (const r of pa.json.reivindicacoes) assert.equal(r.contato_autor, A.username);
    const pb = await get(`/api/itens/${item.id}`, { usuario: B });
    assert.deepEqual(pb.json.reivindicacoes.map((r) => r.id), [rB.id]);
    assert.equal(pb.json.reivindicacoes[0].contato_reivindicante, B.username);
    assert.doesNotMatch(pb.texto, new RegExp(C.username), "B não pode ver o contato de C");
    const pc = await get(`/api/itens/${item.id}`, { usuario: C });
    assert.deepEqual(pc.json.reivindicacoes.map((r) => r.id), [rC.id]);
    assert.doesNotMatch(pc.texto, new RegExp(B.username), "C não pode ver o contato de B");
  });

  test("contatos invisíveis a um terceiro (E) e ao anônimo", async () => {
    for (const quem of [E, null]) {
      const r = await get(`/api/itens/${item.id}`, { usuario: quem });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json.reivindicacoes, []);
      assert.doesNotMatch(r.texto, /contato_/);
      assert.doesNotMatch(r.texto, new RegExp(`${B.username}|${C.username}`));
    }
    const lista = await get(`/api/itens?q=Notebook cinza`, { usuario: E });
    assert.doesNotMatch(lista.texto, /contato_|usuario_b|usuario_c/);
    const minhas = await get("/api/reivindicacoes", { usuario: E });
    assert.deepEqual(minhas.json, { feitas: [], recebidas: [] });
  });

  test("GET /api/reivindicacoes: feitas (B) e recebidas (A) com contatos", async () => {
    const b = await get("/api/reivindicacoes", { usuario: B });
    assert.ok(b.json.feitas.some((r) => r.id === rB.id && r.contato_autor === A.username));
    const a = await get("/api/reivindicacoes", { usuario: A });
    const ids = a.json.recebidas.map((r) => r.id);
    assert.ok(ids.includes(rB.id) && ids.includes(rC.id));
  });

  test("terceiro (E) tenta aceitar, recusar, cancelar e encerrar → 403", async () => {
    assertErro(await post(`/api/reivindicacoes/${rB.id}/aceitar`, { usuario: E }), 403, "aceitar");
    assertErro(await post(`/api/reivindicacoes/${rB.id}/recusar`, { usuario: E }), 403, "recusar");
    assertErro(await post(`/api/reivindicacoes/${rB.id}/cancelar`, { usuario: E }), 403, "cancelar");
    assertErro(await post(`/api/itens/${item.id}/encerrar`, { usuario: E }), 403, "encerrar");
  });

  test("não-autor (C, que também reivindicou) tenta aceitar a de B → 403; B aceita a própria → 403", async () => {
    assertErro(await post(`/api/reivindicacoes/${rB.id}/aceitar`, { usuario: C }), 403);
    assertErro(await post(`/api/reivindicacoes/${rB.id}/aceitar`, { usuario: B }), 403);
  });

  test("aceitar sem Origin → 403 (CSRF)", async () => {
    assertErro(await post(`/api/reivindicacoes/${rB.id}/aceitar`, { usuario: A, origem: null }), 403);
  });

  test("reivindicante (B) não pode encerrar enquanto só está pendente → 403", async () => {
    assertErro(await post(`/api/itens/${item.id}/encerrar`, { usuario: B }), 403);
  });

  test("autor aceita a de B → 200, reivindicação aceita, item em_devolucao", async () => {
    const r = await post(`/api/reivindicacoes/${rB.id}/aceitar`, { usuario: A });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.reivindicacao.status, "aceita");
    assert.equal(r.json.item.status, "em_devolucao");
    assert.equal((await get(`/api/itens/${item.id}`)).json.item.status, "em_devolucao");
  });

  test("aceitar de novo → 409; aceitar a de C com item em_devolucao → 409", async () => {
    assertErro(await post(`/api/reivindicacoes/${rB.id}/aceitar`, { usuario: A }), 409);
    assertErro(await post(`/api/reivindicacoes/${rC.id}/aceitar`, { usuario: A }), 409);
  });

  test("nova reivindicação com item em_devolucao → 409", async () => {
    assertErro(await reivindicar(E, item.id), 409);
  });

  test("DELETE de item em_devolucao → 409", async () => {
    assertErro(await del(`/api/itens/${item.id}`, { usuario: A }), 409);
  });

  test("reivindicante aceito (B) encerra → item encerrado, B concluida, C pendente→recusada", async () => {
    const r = await post(`/api/itens/${item.id}/encerrar`, { usuario: B });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.item.status, "encerrado");
    assert.ok(r.json.item.encerrado_em, "encerrado_em preenchido");
    const pa = await get(`/api/itens/${item.id}`, { usuario: A });
    const st = Object.fromEntries(pa.json.reivindicacoes.map((x) => [x.id, x.status]));
    assert.equal(st[rB.id], "concluida");
    assert.equal(st[rC.id], "recusada");
  });

  test("total_reivindicacoes conta concluida e recusada (só ignora cancelada)", async () => {
    assert.equal((await get(`/api/itens/${item.id}`)).json.item.total_reivindicacoes, 2);
  });

  test("encerrado sai da lista padrão e aparece com status=todos", async () => {
    const padrao = await get(`/api/itens?q=Notebook cinza`);
    assert.ok(!padrao.json.itens.some((i) => i.id === item.id));
    const todos = await get(`/api/itens?q=Notebook cinza&status=todos`);
    assert.ok(todos.json.itens.some((i) => i.id === item.id && i.status === "encerrado"));
  });

  test("encerrar de novo → 409 (autor e reivindicante)", async () => {
    assertErro(await post(`/api/itens/${item.id}/encerrar`, { usuario: A }), 409);
    assertErro(await post(`/api/itens/${item.id}/encerrar`, { usuario: B }), 409);
  });

  test("contatos continuam visíveis às duas partes após o encerramento", async () => {
    const b = await get(`/api/itens/${item.id}`, { usuario: B });
    assert.equal(b.json.reivindicacoes[0].contato_autor, A.username);
  });
});

// =====================================================================
describe("recusar, cancelar, encerrar aberto e apagar (4, 4.3, 6.7)", () => {
  test("recusar: autor recusa pendente → recusada; recusar de novo → 409; B pode reivindicar de novo", async () => {
    const it = await criarItem(C, { titulo: "Garrafa rosa", categoria: "garrafas" });
    const rb = (await reivindicar(B, it.id)).json.reivindicacao;
    const r = await post(`/api/reivindicacoes/${rb.id}/recusar`, { usuario: C });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.reivindicacao.status, "recusada");
    assert.equal(r.json.item.status, "aberto");
    assertErro(await post(`/api/reivindicacoes/${rb.id}/recusar`, { usuario: C }), 409);
    assertErro(await post(`/api/reivindicacoes/${rb.id}/aceitar`, { usuario: C }), 409, "aceitar recusada");
    assert.equal((await reivindicar(B, it.id)).status, 201, "recusada não é ativa");
  });

  test("cancelar: autor não cancela pendente (409); reivindicante cancela aceita → item volta a aberto", async () => {
    const it = await criarItem(C, { titulo: "Jaqueta jeans", categoria: "vestuario" });
    const rb = (await reivindicar(B, it.id)).json.reivindicacao;
    assertErro(await post(`/api/reivindicacoes/${rb.id}/cancelar`, { usuario: C }), 409, "autor cancela pendente");
    assert.equal((await post(`/api/reivindicacoes/${rb.id}/aceitar`, { usuario: C })).status, 200);
    const r = await post(`/api/reivindicacoes/${rb.id}/cancelar`, { usuario: B });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.reivindicacao.status, "cancelada");
    assert.equal(r.json.item.status, "aberto");
    assert.equal(r.json.item.total_reivindicacoes, 0, "cancelada não conta (6.5)");
    assertErro(await post(`/api/reivindicacoes/${rb.id}/cancelar`, { usuario: B }), 409, "cancelar 2x");
    assert.equal((await reivindicar(B, it.id)).status, 201, "pode reivindicar de novo após cancelar");
  });

  test("autor cancela a aceita → item volta a aberto", async () => {
    const it = await criarItem(C, { titulo: "Crachá azul", categoria: "documentos" });
    const re = (await reivindicar(E, it.id)).json.reivindicacao;
    assert.equal((await post(`/api/reivindicacoes/${re.id}/aceitar`, { usuario: C })).status, 200);
    const r = await post(`/api/reivindicacoes/${re.id}/cancelar`, { usuario: C });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.reivindicacao.status, "cancelada");
    assert.equal(r.json.item.status, "aberto");
  });

  test("reivindicante cancela a própria pendente → 200 cancelada", async () => {
    const it = await criarItem(C, { titulo: "Chaveiro", categoria: "vestuario" });
    const re = (await reivindicar(E, it.id)).json.reivindicacao;
    const r = await post(`/api/reivindicacoes/${re.id}/cancelar`, { usuario: E });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.reivindicacao.status, "cancelada");
  });

  test("encerrar item aberto: com pendente → 409; sem reivindicação → 200 (autor)", async () => {
    const it = await criarItem(E, { titulo: "Guarda-chuva", categoria: "vestuario" });
    const rb = (await reivindicar(B, it.id)).json.reivindicacao;
    assertErro(await post(`/api/itens/${it.id}/encerrar`, { usuario: E }), 409, "com pendente");
    assert.equal((await post(`/api/reivindicacoes/${rb.id}/recusar`, { usuario: E })).status, 200);
    const r = await post(`/api/itens/${it.id}/encerrar`, { usuario: E });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.item.status, "encerrado");
    const it2 = await criarItem(E, { titulo: "Pen drive", categoria: "eletronicos" });
    const r2 = await post(`/api/itens/${it2.id}/encerrar`, { usuario: E });
    assert.equal(r2.status, 200, r2.texto);
    assert.equal(r2.json.item.status, "encerrado");
  });

  test("DELETE: não-autor → 403; sem login → 401; autor apaga aberto → { ok: true } e some (404)", async () => {
    const it = await criarItem(E, { titulo: "Caderno verde", categoria: "documentos" });
    assertErro(await del(`/api/itens/${it.id}`, { usuario: B }), 403);
    assertErro(await del(`/api/itens/${it.id}`), 401);
    assertErro(await del(`/api/itens/${it.id}`, { usuario: E, origem: "https://evil.example" }), 403, "CSRF");
    const r = await del(`/api/itens/${it.id}`, { usuario: E });
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual(r.json, { ok: true });
    assertErro(await get(`/api/itens/${it.id}`), 404);
    assertErro(await del(`/api/itens/${it.id}`, { usuario: E }), 404);
  });

  test("reivindicante não pode recusar nem aceitar a própria → 403", async () => {
    const it = await criarItem(C, { titulo: "Boné vermelho", categoria: "vestuario" });
    const rb = (await reivindicar(B, it.id)).json.reivindicacao;
    assertErro(await post(`/api/reivindicacoes/${rb.id}/recusar`, { usuario: B }), 403);
    assertErro(await post(`/api/reivindicacoes/${rb.id}/aceitar`, { usuario: B }), 403);
  });

  test("DELETE de item aberto com reivindicação pendente → 200 (não há aceita)", async () => {
    const it = await criarItem(A, { titulo: "Calculadora", categoria: "eletronicos" });
    const rb = (await reivindicar(B, it.id)).json.reivindicacao;
    const r = await del(`/api/itens/${it.id}`, { usuario: A });
    assert.equal(r.status, 200, r.texto);
    assertErro(await post(`/api/reivindicacoes/${rb.id}/cancelar`, { usuario: B }), 404, "reivindicação foi junto");
  });

  test("6.11: no máximo 5 reivindicações por usuário no mesmo item (inclui canceladas e recusadas) → 6ª é 429", async () => {
    const it = await criarItem(C, { titulo: "Lanterna", categoria: "eletronicos" });
    const st = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await reivindicar(E, it.id);
      st.push(r.status);
      if (r.status === 201) {
        // Alterna: E cancela a própria / C (autor) recusa — nenhuma das duas libera cota.
        const acao = i % 2 === 0 ? ["cancelar", E] : ["recusar", C];
        const c = await post(`/api/reivindicacoes/${r.json.reivindicacao.id}/${acao[0]}`, { usuario: acao[1] });
        assert.equal(c.status, 200, c.texto);
      }
    }
    assert.deepEqual(st, [201, 201, 201, 201, 201]);
    const sexta = await reivindicar(E, it.id);
    assertErro(sexta, 429, "6ª reivindicação");
    assert.equal(sexta.json.erro, "limite_excedido");
    assert.equal((await reivindicar(B, it.id)).status, 201, "o limite é por usuário");
  });

  test("6.11: resumo item.autor na reivindicação traz só os 4 campos públicos", async () => {
    const r = await get("/api/reivindicacoes", { usuario: B });
    const x = r.json.feitas[0];
    assert.ok(x && x.item && x.item.autor, r.texto.slice(0, 300));
    assert.deepEqual(Object.keys(x.item.autor).sort(), ["avatar_url", "nome_exibicao", "user_id", "username"]);
    assert.equal(x.item.autor.user_id, x.item.autor_id);
  });

  test("DELETE de item encerrado → 409", async () => {
    const it = await criarItem(E, { titulo: "Estojo azul", categoria: "documentos" });
    assert.equal((await post(`/api/itens/${it.id}/encerrar`, { usuario: E })).status, 200);
    assertErro(await del(`/api/itens/${it.id}`, { usuario: E }), 409);
  });
});

// =====================================================================
describe("ataques e cabeçalhos de segurança (5)", () => {
  test("XSS armazenado volta como dado JSON (Content-Type application/json), sem interpretação", async () => {
    const payload = `<img src=x onerror=alert(1)>`;
    const it = await criarItem(B, { titulo: payload });
    const r = await get(`/api/itens/${it.id}`);
    assert.match(r.headers.get("content-type"), /^application\/json/);
    assert.equal(r.json.item.titulo, payload);
  });

  test("cabeçalhos de segurança nas respostas da API", async () => {
    const r = await get("/api/itens");
    const csp = r.headers.get("content-security-policy") || "";
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(r.headers.get("referrer-policy"));
    assert.ok(r.headers.get("permissions-policy"));
    assert.match(r.headers.get("strict-transport-security") || "", /max-age=\d+/);
  });

  test("cabeçalhos de segurança na página / (CSP default-src 'self', imagens do cdn.discordapp.com)", async () => {
    const r = await get("/");
    assert.equal(r.status, 200);
    const csp = r.headers.get("content-security-policy") || "";
    assert.match(csp, /default-src 'self'/, `CSP da página: "${csp}"`);
    assert.match(csp, /img-src[^;]*cdn\.discordapp\.com/, `CSP img-src: "${csp}"`);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(r.headers.get("referrer-policy"), "Referrer-Policy");
    assert.ok(r.headers.get("permissions-policy"), "Permissions-Policy");
    assert.match(r.headers.get("strict-transport-security") || "", /max-age=\d+/, "HSTS");
    assert.match(r.texto, /P26-3A-5E56-230D-1716-D540/, "chave no rodapé");
  });

  test("erro interno não vaza detalhes (sem pilha/SQL nas respostas de erro)", async () => {
    const r = await post("/api/itens", { usuario: A, bruto: "{\"tipo\":", cabecalhos: { "Content-Type": "application/json" } });
    assert.doesNotMatch(r.texto, /at \w+ \(|SQLITE|stack/i);
  });
});

// =====================================================================
describe("limite de criação (4.2 e 6.8)", () => {
  test("10 itens por hora passam; o 11º → 429", async () => {
    const res = [];
    for (let i = 0; i < 10; i += 1) res.push((await post("/api/itens", { usuario: D, corpo: itemValido() })).status);
    assert.deepEqual(res, Array(10).fill(201));
    const r = await post("/api/itens", { usuario: D, corpo: itemValido() });
    assertErro(r, 429);
    // O limite é por usuário: outro usuário segue criando.
    assert.equal((await post("/api/itens", { usuario: C, corpo: itemValido() })).status, 201);
  });

  test("rajada concorrente não fura o limite (6.8)", async () => {
    // Usa-se E, que já criou alguns itens nesta rodada: a rajada de 8 não pode passar de 10 no total.
    const antes = (await get("/api/itens?meus=1&status=todos&por_pagina=50", { usuario: E })).json.total;
    const restantes = Math.max(0, 10 - antes);
    const rs = await Promise.all(Array.from({ length: 8 }, () => post("/api/itens", { usuario: E, corpo: itemValido() })));
    const criados = rs.filter((r) => r.status === 201).length;
    assert.ok(rs.every((r) => r.status === 201 || r.status === 429), rs.map((r) => r.status).join(","));
    assert.ok(criados <= restantes, `criou ${criados}, só podia ${restantes}`);
  });
});
