/**
 * Testes das rotas (Fase 2/3): imports, contratos de serialização, hash
 * reconstruído e cookies de sessão.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, relative, sep } from "node:path";

import { canonicalJson, hashCanonico, sha256Hex } from "../functions/_lib/crypto.js";
import { montarPayloadAta, montarSorteio } from "../functions/_lib/sorteio.js";
import { ataPublica, detalheSala, payloadDaAta, resumoSala } from "../functions/_lib/salas.js";
import { destinoSeguro, criarCookie, ErroHttp, responderErro } from "../functions/_lib/http.js";
import { urlAutorizacao, urlAvatar, nomeExibicao } from "../functions/_lib/discord.js";
import { COOKIE_SESSAO, DURACAO_SESSAO_MS, iniciarSessao, sessaoAtual } from "../functions/_lib/sessao.js";

const RAIZ_FUNCTIONS = fileURLToPath(new URL("../functions", import.meta.url));

function arquivosJs(diretorio) {
  const saida = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosJs(caminho));
    else if (caminho.endsWith(".js")) saida.push(caminho);
  }
  return saida;
}

/** D1 falso com respostas programáveis. */
function bancoFalso({ first = null, all = [] } = {}) {
  const chamadas = [];
  return {
    chamadas,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            chamadas.push({ sql, args });
            return {
              first: async () => (typeof first === "function" ? first(sql, args) : first),
              all: async () => ({
                results: typeof all === "function" ? all(sql, args) : all,
              }),
              run: async () => ({ success: true, meta: { changes: 1 } }),
            };
          },
        };
      },
      batch: async (statements) => statements,
    },
  };
}

test("todos os módulos de functions importam e exportam handlers", async () => {
  const arquivos = arquivosJs(RAIZ_FUNCTIONS);
  assert.ok(arquivos.length >= 12, `esperava ao menos 12 arquivos, achei ${arquivos.length}`);

  for (const arquivo of arquivos) {
    const modulo = await import(pathToFileURL(arquivo).href);
    const relativo = relative(RAIZ_FUNCTIONS, arquivo);
    const ehBiblioteca = relativo.split(sep).includes("_lib");
    const ehMiddleware = relativo === "_middleware.js";
    if (ehBiblioteca || ehMiddleware) continue;

    const handlers = Object.keys(modulo).filter(
      (chave) => chave === "onRequest" || /^onRequest(Get|Post|Patch|Put|Delete)$/.test(chave)
    );
    assert.ok(handlers.length > 0, `rota sem handler: ${relativo}`);
  }
});

test("rotas esperadas existem no mapa de arquivos", () => {
  const relativas = new Set(
    arquivosJs(RAIZ_FUNCTIONS).map((arquivo) =>
      relative(RAIZ_FUNCTIONS, arquivo).split(sep).join("/")
    )
  );
  for (const rota of [
    "_middleware.js",
    "api/health.js",
    "api/me.js",
    "api/auth/discord.js",
    "api/auth/discord/callback.js",
    "api/auth/logout.js",
    "api/rooms/index.js",
    "api/rooms/[code].js",
    "api/rooms/[code]/participants.js",
    "api/rooms/[code]/participants/[id].js",
    "api/rooms/[code]/join.js",
    "api/rooms/[code]/draw.js",
    "api/rooms/[code]/draws.js",
    "api/draws/index.js",
    "api/draws/[codigo].js",
  ]) {
    assert.ok(relativas.has(rota), `rota ausente: ${rota}`);
  }
});

test("payloadDaAta reconstrói exatamente o payload hasheado", async () => {
  const participantes = [
    { participantId: 1, userId: "u1", displayName: "Ana", source: "manual" },
    { participantId: 2, userId: null, displayName: "Bruno", source: "manual" },
    { participantId: 3, userId: "u3", displayName: "Carla", source: "discord" },
    { participantId: 4, userId: "u4", displayName: "Diego", source: "discord" },
    { participantId: 5, userId: null, displayName: "Elisa", source: "manual" },
  ];

  for (const modo of ["groups", "order"]) {
    const groupSize = modo === "groups" ? 2 : null;
    const { result, swaps } = montarSorteio({
      participantes,
      mode: modo,
      groupSize,
      rng: (max) => max - 1,
    });
    const payload = montarPayloadAta({
      drawId: "draw-1",
      room: { id: "sala-1", public_code: "ABCD2345", title: "Seminário" },
      seq: 1,
      participantes,
      mode: modo,
      groupSize,
      swaps,
      result,
      verificationCode: "SORT-ABCD-2345",
      prevHash: null,
      createdAt: "2026-11-08T12:00:00.000Z",
      createdByUserId: "dono",
    });
    const hash = await hashCanonico(payload);

    const linha = {
      id: "draw-1",
      room_id: "sala-1",
      seq: 1,
      mode: modo,
      params_json: canonicalJson({ room: payload.room, groupSize }),
      participants_json: canonicalJson(payload.participants),
      result_json: canonicalJson(result),
      swaps_json: canonicalJson(swaps),
      algorithm: "fisher-yates",
      algorithm_version: 1,
      audit_hash: hash,
      prev_hash: null,
      verification_code: "SORT-ABCD-2345",
      created_by_user_id: "dono",
      created_at: "2026-11-08T12:00:00.000Z",
      entries: [],
    };

    assert.deepEqual(payloadDaAta(linha), payload, `payload divergente em ${modo}`);
    assert.equal(await hashCanonico(payloadDaAta(linha)), hash, `hash divergente em ${modo}`);

    const publica = ataPublica(linha, { prevDrawCode: "SORT-ZZZZ-9999" });
    assert.equal(publica.auditHash, hash);
    assert.equal(publica.prevDrawCode, "SORT-ZZZZ-9999");
    assert.equal(publica.verificationUrl, "/api/draws/SORT-ABCD-2345");
  }
});

test("detalheSala e resumoSala não expõem user_id", () => {
  const sala = {
    id: "sala-1",
    public_code: "ABCD2345",
    title: "Seminário",
    mode: "order",
    group_size: null,
    allow_join: 1,
    status: "drawn",
    created_at: "2026-11-08T10:00:00.000Z",
    updated_at: "2026-11-08T11:00:00.000Z",
  };
  const detalhe = detalheSala(sala, {
    participantes: [
      {
        id: 7,
        user_id: "discord-123",
        display_name: "Ana",
        source: "discord",
        joined_at: "2026-11-08T10:30:00.000Z",
      },
    ],
    atas: [
      {
        verification_code: "SORT-ABCD-2345",
        seq: 1,
        mode: "order",
        audit_hash: "a".repeat(64),
        prev_hash: null,
        created_at: "2026-11-08T11:00:00.000Z",
      },
    ],
    isOwner: true,
    ownerName: "Dono",
  });

  assert.equal(detalhe.code, "ABCD2345");
  assert.equal(detalhe.isOwner, true);
  assert.equal(detalhe.ownerName, "Dono");
  assert.equal(detalhe.participants[0].displayName, "Ana");
  assert.equal(Object.hasOwn(detalhe.participants[0], "userId"), false);
  assert.equal(Object.hasOwn(detalhe.participants[0], "user_id"), false);
  assert.equal(detalhe.draws[0].verificationCode, "SORT-ABCD-2345");

  const resumo = resumoSala({ ...sala, participants_count: 5, draws_count: 2 });
  assert.equal(resumo.participantsCount, 5);
  assert.equal(resumo.drawsCount, 2);
  assert.equal(Object.hasOwn(resumo, "owner_user_id"), false);
});

test("destinoSeguro aceita só caminhos internos", () => {
  assert.equal(destinoSeguro("/sala/ABCD2345"), "/sala/ABCD2345");
  assert.equal(destinoSeguro("/sala/ABCD2345?login=success"), "/sala/ABCD2345?login=success");
  assert.equal(destinoSeguro(null), "/");
  assert.equal(destinoSeguro("//evil.example"), "/");
  assert.equal(destinoSeguro("https://evil.example"), "/");
  assert.equal(destinoSeguro("/\\evil.example"), "/");
  assert.equal(destinoSeguro("/ok\nSet-Cookie: x"), "/");
  assert.equal(destinoSeguro("", "/painel"), "/painel");
});

test("urlAutorizacao pede apenas identify e não vaza o secret", () => {
  const request = new Request("https://exemplo.pages.dev/api/auth/discord?next=/sala/X");
  const url = new URL(urlAutorizacao(request, "1569089966770884718", "state-abc"));
  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.searchParams.get("client_id"), "1569089966770884718");
  assert.equal(url.searchParams.get("scope"), "identify");
  assert.equal(url.searchParams.get("state"), "state-abc");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://exemplo.pages.dev/api/auth/discord/callback"
  );
  assert.equal(url.searchParams.has("client_secret"), false);
  assert.equal(url.searchParams.has("prompt"), false);
});

test("urlAvatar e nomeExibicao seguem o perfil do Discord", () => {
  assert.equal(
    urlAvatar({ id: "123", avatar: "abc" }),
    "https://cdn.discordapp.com/avatars/123/abc.png?size=128"
  );
  assert.match(urlAvatar({ id: "123", avatar: null }), /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
  assert.equal(nomeExibicao({ username: "bruno", global_name: "Bruno K" }), "Bruno K");
  assert.equal(nomeExibicao({ username: "bruno", global_name: "   " }), "bruno");
  assert.equal(nomeExibicao({ username: "bruno", global_name: null }), "bruno");
});

test("criarCookie aplica HttpOnly/SameSite/Secure", () => {
  const cookie = criarCookie("teste", "valor com espaço", {
    maxAge: 60,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
  });
  assert.match(cookie, /^teste=valor%20com%20espa%C3%A7o; Path=\/; SameSite=Lax; Max-Age=60; HttpOnly; Secure$/);
});

test("iniciarSessao gera token de 32 bytes e guarda só o hash no D1", async () => {
  const env = bancoFalso();
  const request = new Request("http://localhost:8788/api/auth/discord/callback");
  const sessao = await iniciarSessao(env, request, "user-1");

  assert.match(sessao.token, /^[0-9a-f]{64}$/);
  assert.match(sessao.cookie, new RegExp(`^${COOKIE_SESSAO}=`));
  assert.match(sessao.cookie, /HttpOnly/);
  assert.match(sessao.cookie, /SameSite=Lax/);
  assert.match(sessao.cookie, new RegExp(`Max-Age=${DURACAO_SESSAO_MS / 1000}`));
  assert.doesNotMatch(sessao.cookie, /Secure/, "localhost (HTTP) não deve marcar Secure");

  const gravado = env.chamadas.find((chamada) => /INSERT INTO sessions/.test(chamada.sql));
  assert.ok(gravado, "INSERT INTO sessions não executado");
  assert.equal(gravado.args[0], await sha256Hex(sessao.token));
  assert.notEqual(gravado.args[0], sessao.token);
  assert.equal(gravado.args[1], "user-1");

  const seguro = await iniciarSessao(
    bancoFalso(),
    new Request("https://exemplo.pages.dev/api/auth/discord/callback"),
    "user-1"
  );
  assert.match(seguro.cookie, /; Secure/);
});

test("sessaoAtual lê o cookie, valida hash e expiração", async () => {
  const token = "a".repeat(64);
  const hash = await sha256Hex(token);
  const request = new Request("https://exemplo.pages.dev/api/me", {
    headers: { Cookie: `${COOKIE_SESSAO}=${token}` },
  });

  const valido = bancoFalso({
    first: () => ({
      token_hash: hash,
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      username: "bruno",
      global_name: "Bruno K",
      avatar: "https://cdn.discordapp.com/avatars/1/a.png",
    }),
  });
  const sessao = await sessaoAtual(request, valido);
  assert.equal(sessao.tokenHash, hash);
  assert.deepEqual(sessao.user, {
    userId: "user-1",
    username: "bruno",
    globalName: "Bruno K",
    avatar: "https://cdn.discordapp.com/avatars/1/a.png",
  });
  assert.match(valido.chamadas[0].sql, /FROM sessions s/);
  assert.equal(valido.chamadas[0].args[0], hash);

  // Expira e apaga a linha.
  const expirado = bancoFalso({
    first: () => ({
      token_hash: hash,
      user_id: "user-1",
      expires_at: "2020-01-01T00:00:00.000Z",
      username: "bruno",
      global_name: null,
      avatar: null,
    }),
  });
  assert.equal(await sessaoAtual(request, expirado), null);
  assert.ok(expirado.chamadas.some((chamada) => /DELETE FROM sessions/.test(chamada.sql)));

  // Sem cookie.
  assert.equal(await sessaoAtual(new Request("https://exemplo.pages.dev/"), bancoFalso()), null);

  // Token com tamanho errado nem consulta o banco.
  const curto = bancoFalso();
  const requestCurto = new Request("https://exemplo.pages.dev/", {
    headers: { Cookie: `${COOKIE_SESSAO}=abc` },
  });
  assert.equal(await sessaoAtual(requestCurto, curto), null);
  assert.equal(curto.chamadas.length, 0);
});

test("responderErro padroniza ErroHttp e ErroValidacao", async () => {
  const http = await responderErro(new ErroHttp(403, "sem_permissao", "Sem acesso."));
  assert.equal(http.status, 403);
  assert.deepEqual(await http.json(), {
    ok: false,
    erro: "sem_permissao",
    mensagem: "Sem acesso.",
  });

  const { ErroValidacao } = await import("../functions/_lib/validacao.js");
  const validacao = await responderErro(new ErroValidacao("Título curto.", { campos: ["title"] }));
  assert.equal(validacao.status, 400);
  const corpo = await validacao.json();
  assert.equal(corpo.erro, "validacao");
  assert.deepEqual(corpo.campos, ["title"]);
});
