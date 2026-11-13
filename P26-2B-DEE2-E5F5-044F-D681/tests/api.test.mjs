/**
 * Testes de API, regras de negócio e segurança — Projeto #34
 * Vitrine de Achados e Perdidos do Campus · Chave P26-2B-DEE2-E5F5-044F-D681
 *
 * Node puro (sem dependências): node:test + node:assert + fetch.
 * Roda contra um `wrangler pages dev` com D1 local já migrado e com tests/seed-local.sql aplicado.
 *
 *   BASE_URL=http://localhost:8790 node --test tests/api.test.mjs
 *
 * Reexecutável: cada execução cria seus próprios itens marcados com uma etiqueta única (RUN).
 * O único efeito acumulado é o limite de 20 cadastros/dia por usuário; se aparecer 429
 * fora do teste de limite, rode o seed de novo (ele zera os dados dos usuários de teste).
 */
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:8790").replace(/\/$/, "");
const ORIGIN = new URL(BASE).origin;
const RUN = "run" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

const tok = (par) => par.repeat(32);
const SID = {
  ana: tok("a1"),
  bruno: tok("b2"),
  carla: tok("c3"),
  expirada: tok("e4"),
  logout: tok("d5"),
  desconhecido: "f".repeat(64),
};
const USER_ID = { ana: "900000000000000001", bruno: "900000000000000002", carla: "900000000000000003" };
const USERNAME = { ana: "ana.teste", bruno: "bruno.teste", carla: "carla.teste" };

const DIA = 86400 * 1000;
const hoje = () => new Date().toISOString().slice(0, 10);
// datas calculadas no horário de Brasília (UTC-3), igual ao servidor
const diasAPartirDeHoje = (n) => new Date(Date.now() - 3 * 3600 * 1000 + n * DIA).toISOString().slice(0, 10);

/** Requisição genérica. `user` = chave de SID ou cookie cru em `cookie`. */
async function api(method, path, { user, cookie, body, rawBody, headers = {}, redirect = "manual" } = {}) {
  const h = { ...headers };
  if (user) h.Cookie = `sid=${SID[user]}`;
  if (cookie !== undefined) h.Cookie = cookie;
  const escrita = !["GET", "HEAD"].includes(method);
  if (escrita) {
    if (!("Content-Type" in h)) h["Content-Type"] = "application/json";
    if (!("Origin" in h)) h.Origin = ORIGIN;
  }
  for (const k of Object.keys(h)) if (h[k] === null) delete h[k];
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : escrita ? "{}" : undefined,
    redirect,
  });
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch {}
  return { status: res.status, headers: res.headers, json, texto };
}

function itemValido(extra = {}) {
  return {
    tipo: "encontrei",
    categoria: "eletronicos",
    titulo: `Fone bluetooth preto ${RUN}`,
    local: "Bloco B, sala 203, perto da janela",
    data_ocorrencia: hoje(),
    descricao: "Fone sem fio preto com estojo de carregamento, encontrado embaixo da carteira.",
    ...extra,
  };
}

async function criarItem(user, extra = {}) {
  const r = await api("POST", "/api/items", { user, body: itemValido(extra) });
  if (r.status === 429) {
    assert.fail(`Limite diário atingido para ${user}. Rode de novo: wrangler d1 execute DB --local ... --file tests/seed-local.sql`);
  }
  assert.equal(r.status, 201, `criar item como ${user}: ${r.texto}`);
  assert.ok(Number.isInteger(r.json.id));
  return r.json.id;
}

async function reivindicar(user, itemId, mensagem = `Acho que esse item é meu, tem um adesivo na lateral. ${RUN}`) {
  return api("POST", `/api/items/${itemId}/claims`, { user, body: { mensagem } });
}

const acaoClaim = (user, id, acao) => api("PATCH", `/api/claims/${id}`, { user, body: { acao } });
const acaoItem = (user, id, acao) => api("PATCH", `/api/items/${id}`, { user, body: { acao } });

async function minhasClaims(user) {
  const r = await api("GET", "/api/claims", { user });
  assert.equal(r.status, 200, r.texto);
  return r.json.reivindicacoes;
}
async function claimDe(user, id) {
  return (await minhasClaims(user)).find((c) => c.id === id);
}
async function itemPorId(id, user) {
  const r = await api("GET", `/api/items?q=${encodeURIComponent(RUN)}`, { user });
  assert.equal(r.status, 200, r.texto);
  return r.json.itens.find((i) => i.id === id);
}

// ---------------------------------------------------------------------------------------------

before(async () => {
  let r;
  try {
    r = await api("GET", "/api/status");
  } catch (e) {
    throw new Error(`Servidor não respondeu em ${BASE}. Rode "wrangler pages dev --port 8790" antes. (${e.message})`);
  }
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true, `D1 sem as 4 tabelas — aplique as migrações. ${r.texto}`);
  const me = await api("GET", "/api/me", { user: "ana" });
  assert.equal(me.json?.user?.user_id, USER_ID.ana, "Sessão da ana não encontrada — aplique tests/seed-local.sql");
});

describe("0. Diagnóstico", () => {
  test("GET /api/status: D1 conectado, 4 tabelas, chave do projeto", async () => {
    const r = await api("GET", "/api/status");
    assert.equal(r.status, 200);
    assert.equal(r.json.d1Conectado, true);
    assert.deepEqual(r.json.tabelas, ["claims", "discord_users", "items", "sessions"]);
    assert.equal(r.json.chave, "P26-2B-DEE2-E5F5-044F-D681");
    assert.match(r.headers.get("content-type"), /application\/json/);
  });
});

describe("1. Autenticação", () => {
  test("/api/me sem cookie → user null", async () => {
    const r = await api("GET", "/api/me");
    assert.equal(r.status, 200);
    assert.equal(r.json.user, null);
  });

  test("/api/me com sessão válida → dados do Discord (user_id, nome, avatar)", async () => {
    const r = await api("GET", "/api/me", { user: "bruno" });
    assert.equal(r.json.user.user_id, USER_ID.bruno);
    assert.equal(r.json.user.username, USERNAME.bruno);
    assert.equal(r.json.user.nome, "Bruno Teste");
    assert.match(r.json.user.avatar_url, /^https:\/\/cdn\.discordapp\.com\//);
  });

  test("POST /api/items sem cookie → 401", async () => {
    const r = await api("POST", "/api/items", { body: itemValido() });
    assert.equal(r.status, 401);
    assert.equal(r.json.error, "nao_autenticado");
  });

  test("POST /api/items com sessão EXPIRADA → 401 e /api/me devolve null", async () => {
    const r = await api("POST", "/api/items", { user: "expirada", body: itemValido() });
    assert.equal(r.status, 401);
    const me = await api("GET", "/api/me", { user: "expirada" });
    assert.equal(me.json.user, null);
  });

  test("Token desconhecido (64 hex válidos, sem sessão) → 401", async () => {
    const r = await api("POST", "/api/items", { user: "desconhecido", body: itemValido() });
    assert.equal(r.status, 401);
  });

  test("Cookie mal formado (curto, não-hex, hash do banco no lugar do token) → 401", async () => {
    for (const cookie of [
      "sid=abc",
      "sid=" + "Z".repeat(64),
      "sid=3490f80401886d12f3861ec190f5c16419b26345497a92bc4530e22f5d8b4295", // o hash da ana não serve de token
      "sid=' OR 1=1 --",
    ]) {
      const r = await api("POST", "/api/items", { cookie, body: itemValido() });
      assert.equal(r.status, 401, cookie);
    }
  });

  test("Cookie com codificação % inválida não derruba a API (401, não 500)", async () => {
    const r = await api("POST", "/api/items", { cookie: "sid=%E0%A4%A; outro=1", body: itemValido() });
    assert.equal(r.status, 401, r.texto);
    const me = await api("GET", "/api/me", { cookie: "x=%; sid=%%" });
    assert.equal(me.status, 200, me.texto);
    assert.equal(me.json.user, null);
  });

  test("Rotas privadas sem login → 401 (GET /api/claims, PATCH claims/items, POST claims)", async () => {
    assert.equal((await api("GET", "/api/claims")).status, 401);
    assert.equal((await api("PATCH", "/api/claims/1", { body: { acao: "aceitar" } })).status, 401);
    assert.equal((await api("PATCH", "/api/items/1", { body: { acao: "encerrar" } })).status, 401);
    assert.equal((await api("POST", "/api/items/1/claims", { body: { mensagem: "x".repeat(20) } })).status, 401);
  });

  test("GET /api/auth/discord → 302 para o Discord com state + cookie oauth_state HttpOnly", async () => {
    const r = await api("GET", "/api/auth/discord");
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get("location"));
    assert.equal(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
    assert.equal(loc.searchParams.get("scope"), "identify");
    assert.equal(loc.searchParams.get("response_type"), "code");
    assert.equal(loc.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/discord/callback`);
    assert.ok(loc.searchParams.get("client_id"));
    const state = loc.searchParams.get("state");
    assert.match(state, /^[0-9a-f]{32,}$/);
    const setCookie = r.headers.getSetCookie().find((c) => c.startsWith("oauth_state="));
    assert.ok(setCookie, "cookie oauth_state ausente");
    assert.ok(setCookie.startsWith(`oauth_state=${state};`));
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Max-Age=600/);
  });

  test("Dois inícios de login geram states diferentes", async () => {
    const a = new URL((await api("GET", "/api/auth/discord")).headers.get("location")).searchParams.get("state");
    const b = new URL((await api("GET", "/api/auth/discord")).headers.get("location")).searchParams.get("state");
    assert.notEqual(a, b);
  });

  test("Callback com state diferente do cookie → rejeitado, sem sessão", async () => {
    const r = await api("GET", "/api/auth/discord/callback?code=abc&state=" + "1".repeat(32), {
      cookie: "oauth_state=" + "2".repeat(32),
    });
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location"), /auth_error=state_invalido/);
    assert.ok(!r.headers.getSetCookie().some((c) => c.startsWith("sid=") && !/Max-Age=0/.test(c)));
  });

  test("Callback sem cookie de state → rejeitado", async () => {
    const r = await api("GET", "/api/auth/discord/callback?code=abc&state=" + "1".repeat(32));
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location"), /auth_error=state_invalido/);
    assert.ok(!r.headers.getSetCookie().some((c) => c.startsWith("sid=")));
  });

  test("Callback sem code → parametros_ausentes; usuário negou → cancelado", async () => {
    const a = await api("GET", "/api/auth/discord/callback?state=x", { cookie: "oauth_state=x" });
    assert.match(a.headers.get("location"), /auth_error=parametros_ausentes/);
    const b = await api("GET", "/api/auth/discord/callback?error=access_denied&state=x");
    assert.match(b.headers.get("location"), /auth_error=cancelado/);
  });

  test("Callback não reflete texto arbitrário na URL de retorno (open redirect / injeção)", async () => {
    const r = await api("GET", "/api/auth/discord/callback?error=%3Cscript%3E&state=x");
    const loc = new URL(r.headers.get("location"));
    assert.equal(loc.origin, ORIGIN);
    assert.equal(loc.searchParams.get("auth_error"), "discord_erro");
  });
});

describe("2. Validação do cadastro de item (400 com details por campo)", () => {
  const casos = [
    ["tipo fora da lista", { tipo: "achado" }, "tipo"],
    ["tipo não-string", { tipo: 1 }, "tipo"],
    ["categoria fora da lista", { categoria: "joias" }, "categoria"],
    ["categoria com SQL", { categoria: "eletronicos' OR '1'='1" }, "categoria"],
    ["título curto", { titulo: "ab" }, "titulo"],
    ["título só espaços", { titulo: "      " }, "titulo"],
    ["título longo (81)", { titulo: "x".repeat(81) }, "titulo"],
    ["local curto", { local: "B" }, "local"],
    ["local longo (121)", { local: "y".repeat(121) }, "local"],
    ["descrição curta (9)", { descricao: "123456789" }, "descricao"],
    ["descrição longa (1001)", { descricao: "z".repeat(1001) }, "descricao"],
    ["data futura (+5 dias)", { data_ocorrencia: diasAPartirDeHoje(5) }, "data_ocorrencia"],
    ["data de amanhã (+1 dia)", { data_ocorrencia: diasAPartirDeHoje(1) }, "data_ocorrencia"],
    ["data inexistente (30/02)", { data_ocorrencia: "2026-02-30" }, "data_ocorrencia"],
    ["data em formato BR", { data_ocorrencia: "06/11/2026" }, "data_ocorrencia"],
    ["data com mais de 1 ano", { data_ocorrencia: diasAPartirDeHoje(-400) }, "data_ocorrencia"],
    ["data vazia", { data_ocorrencia: "" }, "data_ocorrencia"],
  ];
  for (const [nome, extra, campo] of casos) {
    test(`${nome} → 400 details.${campo}`, async () => {
      const r = await api("POST", "/api/items", { user: "ana", body: itemValido(extra) });
      assert.equal(r.status, 400, r.texto);
      assert.equal(r.json.error, "validacao");
      assert.ok(r.json.details?.[campo], `faltou details.${campo}: ${r.texto}`);
      assert.deepEqual(Object.keys(r.json.details), [campo], "só o campo inválido deve aparecer");
    });
  }

  test("corpo vazio {} → 400 com os 6 campos em details", async () => {
    const r = await api("POST", "/api/items", { user: "ana", body: {} });
    assert.equal(r.status, 400);
    assert.deepEqual(
      Object.keys(r.json.details).sort(),
      ["categoria", "data_ocorrencia", "descricao", "local", "tipo", "titulo"]
    );
  });

  test("limites exatos aceitos (título 3 e 80, descrição 10 e 1000, data de hoje)", async () => {
    await criarItem("bruno", { titulo: "x".repeat(77) + RUN.slice(0, 3), descricao: "d".repeat(1000), tipo: "perdi", categoria: "vestuario" });
    await criarItem("bruno", { titulo: "Bon", descricao: "0123456789", tipo: "perdi", categoria: "vestuario", local: `Sala ${RUN}` });
  });

  test("campos extras (status, owner_id) são ignorados: item nasce aberto e do usuário logado", async () => {
    const id = await criarItem("bruno", { status: "encerrado", owner_id: USER_ID.ana, id: 1, tipo: "perdi", categoria: "garrafas", titulo: `Garrafa térmica azul ${RUN}` });
    const it = await itemPorId(id, "bruno");
    assert.equal(it.status, "aberto");
    assert.equal(it.eh_meu, true);
    assert.equal(it.autor.nome, "Bruno Teste");
  });
});

describe("3. CSRF, Content-Type, Origin e JSON", () => {
  test("POST sem application/json (text/plain, form, sem header) → 415", async () => {
    for (const ct of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", null]) {
      const r = await api("POST", "/api/items", { user: "ana", rawBody: JSON.stringify(itemValido()), headers: { "Content-Type": ct } });
      assert.equal(r.status, 415, `Content-Type ${ct}: ${r.texto}`);
    }
  });

  test("Content-Type disfarçado 'text/plain; application/json' (CORS-safelisted) → 415", async () => {
    const r = await api("POST", "/api/items", {
      user: "ana",
      rawBody: JSON.stringify(itemValido()),
      headers: { "Content-Type": "text/plain; application/json" },
    });
    assert.equal(r.status, 415, r.texto);
  });

  test("application/json; charset=utf-8 é aceito", async () => {
    const r = await api("POST", "/api/items", {
      user: "ana",
      rawBody: JSON.stringify(itemValido({ titulo: "ab" })),
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    assert.equal(r.status, 400); // passou do 415 e caiu na validação
  });

  test("Origin de outro site (ou 'null') → 403 em POST e PATCH", async () => {
    for (const origin of ["https://evil.example", "null", ORIGIN.replace("localhost", "127.0.0.1") + "0"]) {
      const a = await api("POST", "/api/items", { user: "ana", body: itemValido(), headers: { Origin: origin } });
      assert.equal(a.status, 403, `POST items Origin ${origin}`);
      const b = await api("POST", "/api/items/1/claims", { user: "ana", body: { mensagem: "x".repeat(20) }, headers: { Origin: origin } });
      assert.equal(b.status, 403, `POST claims Origin ${origin}`);
      const c = await api("PATCH", "/api/claims/1", { user: "ana", body: { acao: "aceitar" }, headers: { Origin: origin } });
      assert.equal(c.status, 403, `PATCH claims Origin ${origin}`);
      const d = await api("PATCH", "/api/items/1", { user: "ana", body: { acao: "encerrar" }, headers: { Origin: origin } });
      assert.equal(d.status, 403, `PATCH items Origin ${origin}`);
    }
  });

  test("JSON malformado / não-objeto → 400 json_invalido", async () => {
    for (const raw of ["{tipo:", "[]", "null", "42", '"texto"', "{'a':1}"]) {
      const r = await api("POST", "/api/items", { user: "ana", rawBody: raw });
      assert.equal(r.status, 400, `corpo ${raw}: ${r.texto}`);
      assert.equal(r.json.error, "json_invalido");
    }
  });

  test("Corpo gigante → 413", async () => {
    const r = await api("POST", "/api/items", { user: "ana", body: itemValido({ descricao: "a".repeat(9000) }) });
    assert.equal(r.status, 413);
  });

  test("Respostas de erro são JSON e não têm cache", async () => {
    const r = await api("POST", "/api/items", { body: itemValido() });
    assert.match(r.headers.get("content-type"), /application\/json/);
    assert.equal(r.headers.get("cache-control"), "no-store");
  });
});

describe("4/5. Reivindicações e máquina de estados", () => {
  let A, B, C; // itens
  let c1, c2, c3, c4, c5, c6, c7; // reivindicações

  before(async () => {
    A = await criarItem("ana", { titulo: `Carteira marrom item A ${RUN}`, categoria: "documentos" });
    B = await criarItem("ana", { titulo: `Celular com capa item B ${RUN}` });
    C = await criarItem("bruno", { titulo: `Casaco cinza item C ${RUN}`, tipo: "perdi", categoria: "vestuario" });
  });

  test("Mensagem da reivindicação fora de 10–500 → 400 details.mensagem", async () => {
    for (const mensagem of ["curta", "m".repeat(501), "         ", 12345]) {
      const r = await api("POST", `/api/items/${A}/claims`, { user: "bruno", body: { mensagem } });
      assert.equal(r.status, 400, JSON.stringify(mensagem));
      assert.ok(r.json.details?.mensagem);
    }
  });

  test("Item inexistente → 404; id inválido → 400", async () => {
    assert.equal((await reivindicar("bruno", 2147483000)).status, 404);
    assert.equal((await reivindicar("bruno", "abc")).status, 400);
    assert.equal((await reivindicar("bruno", "-1")).status, 400);
  });

  test("Não pode reivindicar o próprio item → 403", async () => {
    const r = await reivindicar("ana", A);
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "item_proprio");
  });

  test("Reivindicação válida → 201 pendente; duplicada → 409", async () => {
    const r = await reivindicar("bruno", A);
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.status, "pendente");
    c1 = r.json.id;
    const dup = await reivindicar("bruno", A);
    assert.equal(dup.status, 409);
    assert.equal(dup.json.error, "reivindicacao_duplicada");
    const r2 = await reivindicar("carla", A, `Perdi uma carteira assim na quinta-feira. ${RUN}`);
    assert.equal(r2.status, 201);
    c2 = r2.json.id;
  });

  test("Contato do Discord das DUAS partes gravado e visível só para as partes", async () => {
    const vistaBruno = await claimDe("bruno", c1);
    assert.equal(vistaBruno.meu_papel, "reivindicante");
    assert.equal(vistaBruno.dono.discord, USERNAME.ana);
    assert.equal(vistaBruno.dono.user_id, USER_ID.ana);
    assert.equal(vistaBruno.reivindicante.discord, USERNAME.bruno);
    assert.equal(vistaBruno.item.id, A);
    const vistaAna = await claimDe("ana", c1);
    assert.equal(vistaAna.meu_papel, "dono_do_anuncio");
    assert.equal(vistaAna.reivindicante.discord, USERNAME.bruno);
    // carla participa de outra reivindicação do mesmo item, mas não deve ver a do bruno
    assert.equal(await claimDe("carla", c1), undefined);
    assert.ok(await claimDe("carla", c2));
  });

  test("Vitrine pública não expõe username/contato nem owner_id", async () => {
    const r = await api("GET", `/api/items?q=${encodeURIComponent(RUN)}`);
    assert.equal(r.status, 200);
    assert.ok(!r.texto.includes(USERNAME.ana) && !r.texto.includes(USERNAME.bruno), "username do Discord vazou na vitrine");
    assert.ok(!r.texto.includes(USER_ID.ana), "user_id vazou na vitrine");
    const it = r.json.itens.find((i) => i.id === A);
    assert.equal(it.reivindicacoes_pendentes, 2);
    assert.equal(it.eh_meu, false);
  });

  test("minha_reivindicacao e eh_meu refletem o usuário logado", async () => {
    assert.equal((await itemPorId(A, "bruno")).minha_reivindicacao, "pendente");
    assert.equal((await itemPorId(A, "ana")).eh_meu, true);
    assert.equal((await itemPorId(A, "ana")).minha_reivindicacao, null);
  });

  test("Ação inválida → 400 (inclusive nomes de propriedades do Object como 'constructor')", async () => {
    for (const acao of ["voar", "", null, "constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const r = await acaoClaim("ana", c1, acao);
      assert.equal(r.status, 400, `acao ${acao}: ${r.status} ${r.texto}`);
    }
  });

  test("Reivindicação inexistente → 404; id inválido → 400", async () => {
    assert.equal((await acaoClaim("ana", 2147483000, "aceitar")).status, 404);
    assert.equal((await acaoClaim("ana", "0", "aceitar")).status, 400);
  });

  test("Terceiro (carla) não pode aceitar/recusar/cancelar/concluir a do bruno → 403", async () => {
    for (const acao of ["aceitar", "recusar", "cancelar", "concluir"]) {
      const r = await acaoClaim("carla", c1, acao);
      assert.equal(r.status, 403, acao);
    }
  });

  test("Reivindicante não aceita nem recusa a própria → 403; dono não cancela → 403", async () => {
    assert.equal((await acaoClaim("bruno", c1, "aceitar")).status, 403);
    assert.equal((await acaoClaim("bruno", c1, "recusar")).status, 403);
    assert.equal((await acaoClaim("ana", c1, "cancelar")).status, 403);
  });

  test("Concluir uma pendente → 409", async () => {
    const r = await acaoClaim("ana", c1, "concluir");
    assert.equal(r.status, 409);
  });

  test("Dono aceita → claim aceita, item em_devolucao", async () => {
    const r = await acaoClaim("ana", c1, "aceitar");
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.status, "aceita");
    assert.equal(r.json.item_status, "em_devolucao");
    assert.equal((await itemPorId(A)).status, "em_devolucao");
  });

  test("Aceitar outra pendente com item em devolução → 409; aceitar de novo → 409", async () => {
    assert.equal((await acaoClaim("ana", c2, "aceitar")).status, 409);
    assert.equal((await acaoClaim("ana", c1, "aceitar")).status, 409);
  });

  test("Nova reivindicação em item não aberto → 409 item_indisponivel", async () => {
    // carla cancela a dela para não esbarrar na regra de duplicidade e tenta de novo
    const canc = await acaoClaim("carla", c2, "cancelar");
    assert.equal(canc.status, 200);
    assert.equal(canc.json.status, "cancelada");
    assert.equal(canc.json.item_status, "em_devolucao", "cancelar uma pendente não devolve o item");
    const r = await reivindicar("carla", A);
    assert.equal(r.status, 409);
    assert.equal(r.json.error, "item_indisponivel");
  });

  test("Reivindicante conclui → claim concluida, item encerrado com closed_at", async () => {
    const r = await acaoClaim("bruno", c1, "concluir");
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.status, "concluida");
    assert.equal(r.json.item_status, "encerrado");
    const it = await itemPorId(A);
    assert.equal(it.status, "encerrado");
    assert.ok(it.closed_at);
  });

  test("Depois de concluída nada mais muda (todas as ações → 409); item encerrado não aceita claims", async () => {
    assert.equal((await acaoClaim("bruno", c1, "cancelar")).status, 409);
    assert.equal((await acaoClaim("ana", c1, "concluir")).status, 409);
    assert.equal((await acaoClaim("ana", c1, "recusar")).status, 409);
    assert.equal((await acaoClaim("carla", c2, "cancelar")).status, 409);
    assert.equal((await reivindicar("carla", A)).status, 409);
    assert.equal((await acaoItem("ana", A, "encerrar")).status, 409);
  });

  test("Concluir recusa as outras pendentes do item", async () => {
    // novo item com 2 pendentes: aceita uma, conclui pelo DONO, a outra vira recusada
    const D = await criarItem("ana", { titulo: `Garrafa inox item D ${RUN}`, categoria: "garrafas" });
    const x = (await reivindicar("bruno", D)).json.id;
    const y = (await reivindicar("carla", D)).json.id;
    assert.equal((await acaoClaim("ana", x, "aceitar")).status, 200);
    const r = await acaoClaim("ana", x, "concluir");
    assert.equal(r.status, 200);
    assert.equal(r.json.item_status, "encerrado");
    assert.equal((await claimDe("carla", y)).status, "recusada");
  });

  test("Dono recusa → recusada; reivindicante não cancela recusada (409); pode reivindicar de novo", async () => {
    c3 = (await reivindicar("bruno", B)).json.id;
    const r = await acaoClaim("ana", c3, "recusar");
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "recusada");
    assert.equal(r.json.item_status, "aberto");
    assert.equal((await acaoClaim("bruno", c3, "cancelar")).status, 409);
    assert.equal((await acaoClaim("ana", c3, "aceitar")).status, 409);
    const nova = await reivindicar("bruno", B);
    assert.equal(nova.status, 201);
    c4 = nova.json.id;
  });

  test("Reivindicante cancela uma ACEITA → item volta a aberto", async () => {
    assert.equal((await acaoClaim("ana", c4, "aceitar")).json.item_status, "em_devolucao");
    const r = await acaoClaim("bruno", c4, "cancelar");
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "cancelada");
    assert.equal(r.json.item_status, "aberto");
  });

  test("Encerrar item: só o dono (terceiro 403), ação inválida 400, inexistente 404", async () => {
    assert.equal((await acaoItem("carla", B, "encerrar")).status, 403);
    assert.equal((await acaoItem("bruno", B, "encerrar")).status, 403);
    assert.equal((await acaoItem("ana", B, "apagar")).status, 400);
    assert.equal((await acaoItem("ana", B, "constructor")).status, 400);
    assert.equal((await acaoItem("ana", 2147483000, "encerrar")).status, 404);
    assert.equal((await acaoItem("ana", "abc", "encerrar")).status, 400);
  });

  test("Dono encerra → item encerrado; nova reivindicação → 409; encerrar de novo → 409", async () => {
    const r = await acaoItem("ana", B, "encerrar");
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "encerrado");
    assert.equal((await reivindicar("carla", B)).status, 409);
    assert.equal((await acaoItem("ana", B, "encerrar")).status, 409);
  });

  test("Reivindicante cancela uma PENDENTE; encerrar com pendente+aceita → recusada+concluida", async () => {
    c5 = (await reivindicar("ana", C)).json.id;
    const canc = await acaoClaim("ana", c5, "cancelar");
    assert.equal(canc.status, 200);
    assert.equal(canc.json.status, "cancelada");
    c6 = (await reivindicar("ana", C)).json.id; // pode reabrir depois de cancelar
    assert.ok(c6);
    c7 = (await reivindicar("carla", C)).json.id;
    assert.equal((await acaoClaim("bruno", c7, "aceitar")).status, 200);
    const enc = await acaoItem("bruno", C, "encerrar");
    assert.equal(enc.status, 200);
    assert.equal((await claimDe("ana", c6)).status, "recusada");
    assert.equal((await claimDe("carla", c7)).status, "concluida");
    assert.equal((await acaoClaim("carla", c7, "cancelar")).status, 409);
  });
});

describe("6. XSS armazenado", () => {
  const payload = `<script>alert('xss')</script><img src=x onerror=alert(1)> ${RUN}`;
  let id;

  test("Texto com HTML é salvo e devolvido literalmente (como texto, em JSON)", async () => {
    id = await criarItem("ana", {
      titulo: `<b>XSS</b> ${RUN}`,
      local: `<img src=x onerror=alert(1)>`,
      descricao: payload,
    });
    const r = await api("GET", `/api/items?q=${encodeURIComponent(RUN)}`);
    assert.match(r.headers.get("content-type"), /^application\/json/);
    const it = r.json.itens.find((i) => i.id === id);
    assert.equal(it.titulo, `<b>XSS</b> ${RUN}`);
    assert.equal(it.local, `<img src=x onerror=alert(1)>`);
    assert.equal(it.descricao, payload);
  });

  test("Mensagem de reivindicação com HTML é devolvida literalmente", async () => {
    const r = await reivindicar("bruno", id, `<script>document.cookie</script> ${RUN}`);
    assert.equal(r.status, 201);
    const c = await claimDe("ana", r.json.id);
    assert.equal(c.mensagem, `<script>document.cookie</script> ${RUN}`);
  });

  test("Front-end (public/*.js) não injeta dados dinâmicos via innerHTML/insertAdjacentHTML/document.write", async () => {
    const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
    const arquivos = (await readdir(pub)).filter((f) => f.endsWith(".js"));
    const problemas = [];
    for (const f of arquivos) {
      const linhas = (await readFile(join(pub, f), "utf8")).split("\n");
      linhas.forEach((l, i) => {
        if (/insertAdjacentHTML|document\.write|outerHTML\s*=/.test(l)) problemas.push(`${f}:${i + 1}: ${l.trim()}`);
        const m = l.match(/\.innerHTML\s*\+?=\s*(.*)$/);
        // permitido: limpar ("") ou string literal fixa sem interpolação
        if (m && !/^(["'])[^"'`$]*\1\s*;?\s*$/.test(m[1].trim())) problemas.push(`${f}:${i + 1}: ${l.trim()}`);
      });
    }
    assert.deepEqual(problemas, [], "uso inseguro de HTML dinâmico no front");
  });
});

describe("7. SQL injection e filtros da vitrine", () => {
  let idAspas, idPerdi;

  before(async () => {
    idAspas = await criarItem("bruno", {
      titulo: `Garrafa d'água 100% inox ${RUN}`,
      tipo: "perdi",
      categoria: "garrafas",
      local: `Cantina "central" ${RUN}`,
    });
    idPerdi = idAspas;
  });

  test("q com aspas encontra o texto com aspas (bind, não concatenação)", async () => {
    const r = await api("GET", `/api/items?q=${encodeURIComponent("d'água 100")}`);
    assert.equal(r.status, 200, r.texto);
    assert.ok(r.json.itens.some((i) => i.id === idAspas));
  });

  test("Payloads de SQL injection em q → 200, sem vazar outros itens nem erro", async () => {
    for (const q of [
      `${RUN}' OR '1'='1`,
      `${RUN}" OR "1"="1`,
      `${RUN}') OR 1=1 --`,
      `${RUN}'; DROP TABLE items; --`,
      `${RUN} UNION SELECT token_hash,1,1,1,1,1,1,1,1,1,1,1,1,1,1 FROM sessions --`,
    ]) {
      const r = await api("GET", `/api/items?q=${encodeURIComponent(q)}`);
      assert.equal(r.status, 200, `q=${q}: ${r.texto}`);
      assert.equal(r.json.total, 0, `q=${q} deveria não achar nada`);
    }
    const st = await api("GET", "/api/status");
    assert.equal(st.json.tabelas.length, 4, "tabela sumiu!");
  });

  test("% e _ em q não viram curingas nem quebram a consulta", async () => {
    for (const q of ["%", "_", "%%%", "100%", "\\", "%' --"]) {
      const r = await api("GET", `/api/items?q=${encodeURIComponent(q)}`);
      assert.equal(r.status, 200, `q=${q}: ${r.texto}`);
      assert.ok(Array.isArray(r.json.itens));
    }
    const r = await api("GET", `/api/items?q=${encodeURIComponent(RUN + "%")}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.itens.every((i) => (i.titulo + i.local + i.descricao).includes(RUN)));
  });

  test("q muito longo é truncado sem erro", async () => {
    // o D1 limita o padrão do LIKE a 50 bytes: q longo (ou com acentos, 2 bytes cada) não pode dar 500
    for (const q of ["a".repeat(5000), "a".repeat(49), "ç".repeat(40), "😀".repeat(30)]) {
      const r = await api("GET", `/api/items?q=${encodeURIComponent(q)}`);
      assert.equal(r.status, 200, `q com ${q.length} chars: ${r.texto}`);
    }
    // um termo de busca longo e legítimo continua encontrando o item
    const r = await api("GET", `/api/items?q=${encodeURIComponent(itemValido().descricao + " e mais texto")}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.itens.some((i) => i.id === idAspas), "busca longa truncada deveria achar o item");
  });

  test("Filtros com valor fora da lista (ou com SQL) → 400", async () => {
    assert.equal((await api("GET", "/api/items?tipo=achado")).status, 400);
    assert.equal((await api("GET", `/api/items?tipo=${encodeURIComponent("perdi' OR '1'='1")}`)).status, 400);
    assert.equal((await api("GET", "/api/items?categoria=joias")).status, 400);
    assert.equal((await api("GET", "/api/items?status=apagado")).status, 400);
  });

  test("Filtro tipo", async () => {
    for (const tipo of ["perdi", "encontrei"]) {
      const r = await api("GET", `/api/items?tipo=${tipo}&q=${RUN}`);
      assert.equal(r.status, 200);
      assert.ok(r.json.total > 0, `nenhum item ${tipo}`);
      assert.ok(r.json.itens.every((i) => i.tipo === tipo));
    }
    assert.ok((await api("GET", `/api/items?tipo=perdi&q=${RUN}`)).json.itens.some((i) => i.id === idPerdi));
  });

  test("Filtro categoria (as 4 categorias)", async () => {
    for (const categoria of ["eletronicos", "documentos", "garrafas", "vestuario"]) {
      const r = await api("GET", `/api/items?categoria=${categoria}&q=${RUN}`);
      assert.equal(r.status, 200);
      assert.ok(r.json.total > 0, `nenhum item em ${categoria}`);
      assert.ok(r.json.itens.every((i) => i.categoria === categoria));
    }
  });

  test("Filtro status (aberto, em_devolucao, encerrado)", async () => {
    for (const status of ["aberto", "encerrado"]) {
      const r = await api("GET", `/api/items?status=${status}&q=${RUN}`);
      assert.equal(r.status, 200);
      assert.ok(r.json.total > 0, `nenhum item ${status}`);
      assert.ok(r.json.itens.every((i) => i.status === status));
    }
    const r = await api("GET", `/api/items?status=em_devolucao&q=${RUN}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.itens.every((i) => i.status === "em_devolucao"));
  });

  test("Filtros combinados (tipo + categoria + status + q)", async () => {
    const r = await api("GET", `/api/items?tipo=perdi&categoria=garrafas&status=aberto&q=${encodeURIComponent("d'água")}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.itens.some((i) => i.id === idAspas));
    assert.ok(r.json.itens.every((i) => i.tipo === "perdi" && i.categoria === "garrafas" && i.status === "aberto"));
  });

  test("meus=1 sem login → 401; com login traz só os itens do usuário", async () => {
    assert.equal((await api("GET", "/api/items?meus=1")).status, 401);
    const r = await api("GET", `/api/items?meus=1&q=${RUN}`, { user: "bruno" });
    assert.equal(r.status, 200);
    assert.ok(r.json.total > 0);
    assert.ok(r.json.itens.every((i) => i.eh_meu === true && i.autor.nome === "Bruno Teste"));
    assert.ok(r.json.itens.some((i) => i.id === idAspas));
    const carla = await api("GET", `/api/items?meus=1&q=${RUN}`, { user: "carla" });
    assert.equal(carla.json.total, 0);
  });

  test("Ordenação: abertos antes de encerrados", async () => {
    const r = await api("GET", `/api/items?q=${RUN}`);
    const ordem = { aberto: 0, em_devolucao: 1, encerrado: 2 };
    const seq = r.json.itens.map((i) => ordem[i.status]);
    assert.deepEqual(seq, [...seq].sort((a, b) => a - b));
  });
});

describe("8. Logout e limite diário", () => {
  test("POST /api/auth/logout apaga a sessão no D1 e expira o cookie", async () => {
    const r = await api("POST", "/api/auth/logout", { user: "logout" });
    assert.equal(r.status, 200);
    const sc = r.headers.getSetCookie().find((c) => c.startsWith("sid="));
    assert.match(sc, /Max-Age=0/);
    assert.match(sc, /HttpOnly/i);
    const me = await api("GET", "/api/me", { user: "logout" });
    assert.equal(me.json.user, null);
    assert.equal((await api("POST", "/api/items", { user: "logout", body: itemValido() })).status, 401);
  });

  test("Limite de 20 cadastros por dia → 429 (usa a carla)", async () => {
    let criados = 0;
    let bloqueou = false;
    for (let i = 0; i < 21; i++) {
      const r = await api("POST", "/api/items", {
        user: "carla",
        body: itemValido({ titulo: `Item de carga ${i} ${RUN}`, tipo: "perdi", categoria: "vestuario" }),
      });
      if (r.status === 429) { bloqueou = true; assert.equal(r.json.error, "limite_diario"); break; }
      assert.equal(r.status, 201, r.texto);
      criados++;
    }
    assert.ok(bloqueou, "não houve 429 após 21 tentativas");
    assert.ok(criados <= 20);
  });
});
