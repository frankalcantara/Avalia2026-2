/**
 * Teste de ponta a ponta contra o `wrangler pages dev` local.
 *
 * Pré-requisitos:
 *   1. banco local com a migration aplicada;
 *   2. `npx.cmd wrangler d1 execute DB --local --file=scripts/semear-sessoes.sql`;
 *   3. servidor em http://127.0.0.1:8788.
 *
 * Uso:
 *   node scripts/e2e-api.mjs
 *   $env:E2E_BASE="http://127.0.0.1:8788"; node scripts/e2e-api.mjs
 *
 * Cobre autenticação por sessão, CRUD de salas, entrada por Discord,
 * sorteio versionado, ata pública e verificação do hash no "navegador".
 */

import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const BASE = process.env.E2E_BASE || "http://127.0.0.1:8788";
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const { aplicarSwaps } = await import(
  pathToFileURL(join(RAIZ, "functions/_lib/sorteio.js")).href
);
const { hashCanonico, canonicalJson } = await import(
  pathToFileURL(join(RAIZ, "functions/_lib/crypto.js")).href
);

const tokenDono = process.env.E2E_TOKEN_DONO || "a".repeat(64);
const tokenAluno = process.env.E2E_TOKEN_ALUNO || "b".repeat(64);
const tokenAluna = process.env.E2E_TOKEN_ALUNA || "c".repeat(64);

const cookieDono = `sorteio_sessao=${tokenDono}`;
const cookieAluno = `sorteio_sessao=${tokenAluno}`;
const cookieAluna = `sorteio_sessao=${tokenAluna}`;

let passos = 0;
function ok(condicao, mensagem) {
  assert.ok(condicao, mensagem);
  passos += 1;
}

async function chamar(method, caminho, { cookie, corpo, headers = {} } = {}) {
  const cabecalhos = { ...headers };
  if (cookie) cabecalhos.Cookie = cookie;
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  const resposta = await fetch(`${BASE}${caminho}`, {
    method,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    redirect: "manual",
  });
  const texto = await resposta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return { status: resposta.status, headers: resposta.headers, json, texto };
}

function verificarAta(ata) {
  const { auditHash, prevDrawCode, entries, verificationUrl, ...payload } = ata;
  assert.match(ata.auditHash, /^[0-9a-f]{64}$/);

  const ordemAplicada = aplicarSwaps(ata.participants, ata.swaps).map((p) => p.participantId);
  const ordemResultado =
    ata.mode === "order"
      ? ata.result.order.map((item) => item.participantId)
      : ata.result.groups.flatMap((grupo) => grupo.members.map((item) => item.participantId));
  assert.deepEqual(ordemAplicada, ordemResultado, "swaps não reproduzem o resultado");
  assert.equal(entries.length, ata.participants.length, "entradas normalizadas incompletas");
  assert.deepEqual(
    entries.map((e) => e.position),
    entries.map((_, i) => i + 1),
    "posições das entradas fora de sequência"
  );
  return { payload, prevDrawCode, verificationUrl };
}

// ---------------------------------------------------------------------------
// Health e identidade
// ---------------------------------------------------------------------------
const health = await chamar("GET", "/api/health");
ok(health.status === 200, `health status ${health.status}`);
ok(health.json.ok === true && health.json.banco === "ok", "health não confirmou o D1");
ok(health.json.chave === "P26-2A-B12E-0CFD-70CA-18E1", "chave do projeto ausente no health");
ok(health.headers.get("x-content-type-options") === "nosniff", "cabeçalho nosniff ausente");
ok((health.headers.get("content-security-policy") || "").includes("default-src 'self'"), "CSP ausente");

const anon = await chamar("GET", "/api/me");
ok(anon.status === 200 && anon.json.autenticado === false, "/api/me anônimo deveria ser false");

const eu = await chamar("GET", "/api/me", { cookie: cookieDono });
ok(eu.status === 200 && eu.json.autenticado === true, "sessão do dono não reconhecida");
ok(
  eu.json.usuario.userId === "dono-1" && eu.json.usuario.globalName === "Dono da Sala",
  "perfil do dono incorreto"
);

// ---------------------------------------------------------------------------
// Criação de sala
// ---------------------------------------------------------------------------
const semLogin = await chamar("POST", "/api/rooms", { corpo: { title: "Sem login", mode: "order" } });
ok(semLogin.status === 401, `criar sala sem login deveria dar 401, deu ${semLogin.status}`);

const criada = await chamar("POST", "/api/rooms", {
  cookie: cookieDono,
  corpo: { title: "  Seminário   de Engenharia ", mode: "groups", groupSize: 2 },
});
ok(criada.status === 201, `criar sala: status ${criada.status} (${criada.texto})`);
const sala = criada.json.sala;
ok(/^[0-9A-Z]{8}$/.test(sala.code), `código de sala inválido: ${sala.code}`);
ok(
  sala.title === "Seminário de Engenharia" && sala.mode === "groups" && sala.groupSize === 2,
  "normalização da sala"
);
ok(sala.allowJoin === true && sala.status === "open", "estado inicial da sala");

const minhas = await chamar("GET", "/api/rooms", { cookie: cookieDono });
ok(minhas.status === 200 && minhas.json.salas.some((s) => s.code === sala.code), "sala não aparece em /api/rooms");

const doAluno = await chamar("GET", "/api/rooms", { cookie: cookieAluno });
ok(doAluno.json.salas.every((s) => s.code !== sala.code), "aluno não deveria ver a sala do dono");

const invalida = await chamar("POST", "/api/rooms", {
  cookie: cookieDono,
  corpo: { title: "ab", mode: "groups", groupSize: 2 },
});
ok(invalida.status === 400, "título curto deveria ser rejeitado");

// ---------------------------------------------------------------------------
// Participantes manuais
// ---------------------------------------------------------------------------
const caminhoSala = `/api/rooms/${sala.code}`;
const addManual = await chamar("POST", `${caminhoSala}/participants`, {
  cookie: cookieDono,
  corpo: { texto: "Ana\n\nBruno\nCarla\nDiego\nElisa\n" },
});
ok(addManual.status === 201 && addManual.json.total === 5, `adicionar manuais: ${addManual.texto}`);
ok(addManual.json.participantes.every((p) => p.source === "manual"), "origem manual incorreta");

const duplicado = await chamar("POST", `${caminhoSala}/participants`, {
  cookie: cookieDono,
  corpo: { nomes: ["ana"] },
});
ok(duplicado.status === 400 && /duplic/i.test(duplicado.texto), "duplicado por caixa deveria falhar");

const origemRuim = await chamar("POST", `${caminhoSala}/participants`, {
  cookie: cookieDono,
  corpo: { nomes: ["Zeca"] },
  headers: { Origin: "https://evil.example" },
});
ok(origemRuim.status === 403, `origem cruzada deveria dar 403, deu ${origemRuim.status}`);

const naoDono = await chamar("POST", `${caminhoSala}/participants`, {
  cookie: cookieAluno,
  corpo: { nomes: ["Zeca"] },
});
ok(naoDono.status === 403, `não-dono deveria dar 403, deu ${naoDono.status}`);

// ---------------------------------------------------------------------------
// Entrada via Discord (self-join)
// ---------------------------------------------------------------------------
const entrada1 = await chamar("POST", `${caminhoSala}/join`, { cookie: cookieAluno });
ok(entrada1.status === 201 && entrada1.json.participante.displayName === "Aluno Teste", `join: ${entrada1.texto}`);

const entrada2 = await chamar("POST", `${caminhoSala}/join`, { cookie: cookieAluno });
ok(entrada2.status === 200 && entrada2.json.jaParticipava === true, "segundo join deveria ser idempotente");

const entrada3 = await chamar("POST", `${caminhoSala}/join`, { cookie: cookieAluna });
ok(entrada3.status === 201, `segunda aluna não entrou: ${entrada3.texto}`);

const publica = await chamar("GET", caminhoSala);
ok(
  publica.status === 200 && publica.json.sala.participants.length === 7,
  `sala deveria ter 7 participantes: ${publica.texto}`
);
ok(
  publica.json.sala.isOwner === false && publica.json.sala.ownerName === "Dono da Sala",
  "detalhe público incorreto"
);
ok(
  publica.json.sala.participants.every((p) => !Object.hasOwn(p, "userId") && !Object.hasOwn(p, "user_id")),
  "detalhe público vazou user_id"
);

// ---------------------------------------------------------------------------
// Sorteio em grupos (versionado)
// ---------------------------------------------------------------------------
const sorteioAluno = await chamar("POST", `${caminhoSala}/draw`, { cookie: cookieAluno });
ok(sorteioAluno.status === 403, "não-dono não pode sortear");

const sorteio1 = await chamar("POST", `${caminhoSala}/draw`, { cookie: cookieDono });
ok(sorteio1.status === 201, `sorteio 1: ${sorteio1.status} ${sorteio1.texto}`);
const ata1 = sorteio1.json.ata;
ok(/^SORT-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(ata1.verificationCode), "formato do código da ata");
ok(ata1.seq === 1 && ata1.prevHash === null && ata1.prevDrawCode === null, "primeira ata com elo anterior");
ok(ata1.mode === "groups" && ata1.groupSize === 2, "parâmetros da ata");
ok(ata1.participants.length === 7, "snapshot de participantes incompleto");
ok(
  JSON.stringify(ata1.result.groups.map((g) => g.members.length)) === JSON.stringify([2, 2, 2, 1]),
  `distribuição inesperada: ${JSON.stringify(ata1.result.groups.map((g) => g.members.length))}`
);

const { payload: payload1 } = verificarAta(ata1);
ok((await hashCanonico(payload1)) === ata1.auditHash, "hash da ata 1 não confere");

const sorteio2 = await chamar("POST", `${caminhoSala}/draw`, { cookie: cookieDono });
ok(sorteio2.status === 201 && sorteio2.json.ata.seq === 2, "segundo sorteio deveria ser seq 2");
const ata2 = sorteio2.json.ata;
ok(ata2.prevHash === ata1.auditHash, "encadeamento prev_hash quebrado");
ok(ata2.prevDrawCode === ata1.verificationCode, "código da ata anterior incorreto");
const { payload: payload2 } = verificarAta(ata2);
ok((await hashCanonico(payload2)) === ata2.auditHash, "hash da ata 2 não confere");
ok(ata2.verificationCode !== ata1.verificationCode, "códigos de ata repetidos");

// ---------------------------------------------------------------------------
// Consulta pública da ata
// ---------------------------------------------------------------------------
const ataPublica1 = await chamar("GET", `/api/draws/${ata1.verificationCode}`);
ok(ataPublica1.status === 200, `consulta pública da ata: ${ataPublica1.status}`);
ok(ataPublica1.json.ata.auditHash === ata1.auditHash, "hash divergente na consulta pública");
const { payload: payloadPublico } = verificarAta(ataPublica1.json.ata);
ok((await hashCanonico(payloadPublico)) === ata1.auditHash, "hash público não reproduz");
ok(canonicalJson(payloadPublico) === canonicalJson(payload1), "payload público difere do payload original");

const minusculo = await chamar("GET", `/api/draws/${ata1.verificationCode.toLowerCase()}`);
ok(
  minusculo.status === 200 && minusculo.json.ata.auditHash === ata1.auditHash,
  "código minúsculo não normalizado"
);

const inexistente = await chamar("GET", "/api/draws/SORT-ZZZZ-9999");
ok(inexistente.status === 404, "ata inexistente deveria dar 404");

const malformada = await chamar("GET", "/api/draws/abc");
ok(malformada.status === 400, "código malformado deveria dar 400");

const recentes = await chamar("GET", "/api/draws?limite=10");
ok(recentes.status === 200 && recentes.json.draws.length >= 2, "lista pública de atas incompleta");
ok(recentes.json.draws[0].room.code === sala.code, "lista pública sem a sala");

const historico = await chamar("GET", `${caminhoSala}/draws`);
ok(historico.status === 200 && historico.json.draws.length === 2, "histórico da sala deveria ter 2 atas");

// ---------------------------------------------------------------------------
// Edição, remoção e proteção da ata
// ---------------------------------------------------------------------------
const patchDono = await chamar("PATCH", caminhoSala, {
  cookie: cookieDono,
  corpo: { allowJoin: false, groupSize: 3 },
});
ok(
  patchDono.status === 200 && patchDono.json.sala.allowJoin === false && patchDono.json.sala.groupSize === 3,
  `patch: ${patchDono.texto}`
);

const patchRoubado = await chamar("PATCH", caminhoSala, {
  cookie: cookieAluno,
  corpo: { title: "Tomada de controle" },
});
ok(patchRoubado.status === 403, "não-dono não pode editar");

const entrarFechada = await chamar("POST", `${caminhoSala}/join`, { cookie: cookieDono });
ok(entrarFechada.status === 403, "entrada deveria estar fechada");

const excluirComAta = await chamar("DELETE", caminhoSala, { cookie: cookieDono });
ok(excluirComAta.status === 409, "sala com ata não pode ser excluída");

const participantesAgora = await chamar("GET", `${caminhoSala}/participants`);
const alvo = participantesAgora.json.participantes.find((p) => p.source === "manual");
const remover = await chamar("DELETE", `${caminhoSala}/participants/${alvo.id}`, { cookie: cookieDono });
ok(remover.status === 200, `remover participante: ${remover.texto}`);
const depois = await chamar("GET", `${caminhoSala}/participants`);
ok(depois.json.participantes.length === 6, "participante não foi removido");

const sair = await chamar("DELETE", `${caminhoSala}/join`, { cookie: cookieAluna });
ok(sair.status === 200, "aluna não conseguiu sair");

// ---------------------------------------------------------------------------
// Sala no modo ordem de apresentação
// ---------------------------------------------------------------------------
const salaOrdem = await chamar("POST", "/api/rooms", {
  cookie: cookieAluno,
  corpo: { title: "Apresentação de Projetos", mode: "order" },
});
ok(salaOrdem.status === 201 && salaOrdem.json.sala.groupSize === null, "sala de ordem inválida");
const codigoOrdem = salaOrdem.json.sala.code;

const addOrdem = await chamar("POST", `/api/rooms/${codigoOrdem}/participants`, {
  cookie: cookieAluno,
  corpo: { nomes: ["Bia", "Caio", "Duda"] },
});
ok(addOrdem.status === 201 && addOrdem.json.total === 3, "participantes da sala de ordem");

const sorteioOrdem = await chamar("POST", `/api/rooms/${codigoOrdem}/draw`, { cookie: cookieAluno });
ok(sorteioOrdem.status === 201, `sorteio de ordem: ${sorteioOrdem.texto}`);
const ataOrdem = sorteioOrdem.json.ata;
ok(ataOrdem.mode === "order" && ataOrdem.groupSize === null, "parâmetros da ata de ordem");
ok(
  JSON.stringify(ataOrdem.result.order.map((i) => i.position)) === JSON.stringify([1, 2, 3]),
  "posições da ordem de apresentação"
);
const { payload: payloadOrdem } = verificarAta(ataOrdem);
ok((await hashCanonico(payloadOrdem)) === ataOrdem.auditHash, "hash da ata de ordem não confere");

const ataOrdemPublica = await chamar("GET", `/api/draws/${ataOrdem.verificationCode}`);
ok(
  ataOrdemPublica.status === 200 && ataOrdemPublica.json.ata.auditHash === ataOrdem.auditHash,
  "ata de ordem pública"
);

// ---------------------------------------------------------------------------
// Logout invalida a sessão no servidor
// ---------------------------------------------------------------------------
const logout = await chamar("POST", "/api/auth/logout", { cookie: cookieDono });
ok(logout.status === 200 && logout.json.ok === true, "logout falhou");
const setCookie = logout.headers.getSetCookie().join("; ");
ok(/sorteio_sessao=/.test(setCookie) && /Max-Age=0/.test(setCookie), `cookie não foi expirado: ${setCookie}`);

const depoisLogout = await chamar("GET", "/api/me", { cookie: cookieDono });
ok(depoisLogout.json.autenticado === false, "sessão continuou válida após logout");

console.log(`\nOK — ${passos} verificações de ponta a ponta passaram.`);
