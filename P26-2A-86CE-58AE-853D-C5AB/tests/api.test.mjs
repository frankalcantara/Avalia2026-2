import assert from "node:assert/strict";
import { after, test } from "node:test";

const BASE_URL = "http://localhost:8788";
const TOKEN_A = "teste-a";
const TOKEN_B = "teste-b";
const TOKEN_LOGOUT = "teste-logout";
const createdCardIds = new Set();

async function api(path, { method = "GET", token, cookie, body, rawBody, redirect } = {}) {
  const headers = {};
  if (token) headers.Cookie = `sessao=${token}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined || rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : (body === undefined ? undefined : JSON.stringify(body)),
    redirect,
  });
  return response;
}

async function createCard(fields = {}, token = TOKEN_A) {
  const response = await api("/api/cartoes", {
    method: "POST",
    token,
    body: { titulo: "Cartao de teste", descricao: "", prioridade: "media", ...fields },
  });
  const card = await response.json();
  if (card.id) createdCardIds.add(card.id);
  return { response, card };
}

async function removeCard(id, token = TOKEN_A) {
  const response = await api(`/api/cartoes/${id}`, { method: "DELETE", token });
  assert.ok([204, 404].includes(response.status), `limpeza do cartão ${id}: HTTP ${response.status}`);
  createdCardIds.delete(id);
}

after(async () => {
  for (const id of createdCardIds) {
    await removeCard(id);
  }
});

test("1. Rotas de sessão e cartões exigem autenticação", async () => {
  const [cards, session] = await Promise.all([
    api("/api/cartoes"),
    api("/api/sessao"),
  ]);
  assert.equal(cards.status, 401);
  assert.equal(session.status, 401);
});

test("2. Cookie com token de sessão inexistente é recusado", async () => {
  const response = await api("/api/cartoes", { token: "token-inexistente" });
  assert.equal(response.status, 401);
});

test("3. Cookie legado discord_session em base64 não autentica", async () => {
  const oldPayload = Buffer.from(encodeURIComponent(JSON.stringify({ userId: "222" }))).toString("base64");
  const cookie = `discord_session=${oldPayload}`;
  const [cards, session] = await Promise.all([
    api("/api/cartoes", { cookie }),
    api("/api/sessao", { cookie }),
  ]);
  assert.equal(cards.status, 401);
  assert.equal(session.status, 401);
});

test("4. Usuário B não lista, altera ou exclui cartão do usuário A", async () => {
  const { response: created, card } = await createCard();
  try {
    assert.equal(created.status, 201);

    const listResponse = await api("/api/cartoes", { token: TOKEN_B });
    assert.equal(listResponse.status, 200);
    const userBCards = await listResponse.json();
    assert.ok(Array.isArray(userBCards));
    assert.equal(userBCards.some((item) => item.id === card.id), false);

    const patchResponse = await api(`/api/cartoes/${card.id}`, {
      method: "PATCH",
      token: TOKEN_B,
      body: { titulo: "Alteracao indevida" },
    });
    const deleteResponse = await api(`/api/cartoes/${card.id}`, {
      method: "DELETE",
      token: TOKEN_B,
    });
    assert.equal(patchResponse.status, 404);
    assert.equal(deleteResponse.status, 404);

    const ownerListResponse = await api("/api/cartoes", { token: TOKEN_A });
    const ownerCards = await ownerListResponse.json();
    assert.equal(ownerCards.find((item) => item.id === card.id).titulo, "Cartao de teste");
  } finally {
    await removeCard(card.id);
  }
});

test("5. Validações de cartão inválidas retornam 400", async () => {
  const { response: created, card } = await createCard();
  const title121 = "x".repeat(121);
  try {
    assert.equal(created.status, 201);
    const cases = [
      api(`/api/cartoes/${card.id}`, { method: "PATCH", token: TOKEN_A, body: { coluna: "feito" } }),
      api(`/api/cartoes/${card.id}`, { method: "PATCH", token: TOKEN_A, body: { prioridade: "urgente" } }),
      api("/api/cartoes", { method: "POST", token: TOKEN_A, body: { titulo: "" } }),
      api("/api/cartoes", { method: "POST", token: TOKEN_A, body: { titulo: title121 } }),
      api("/api/cartoes", { method: "POST", token: TOKEN_A, body: { titulo: "x", descricao: "x".repeat(1001) } }),
      api(`/api/cartoes/${card.id}`, { method: "PATCH", token: TOKEN_A, body: { posicao: "abc" } }),
      api("/api/cartoes/id-nao-numerico", { method: "PATCH", token: TOKEN_A, body: { titulo: "x" } }),
      api("/api/cartoes", { method: "POST", token: TOKEN_A, rawBody: "{ nao-json" }),
      api(`/api/cartoes/${card.id}`, { method: "PATCH", token: TOKEN_A, body: { campo_desconhecido: "ignorar", user_id: "222" } }),
    ];
    const responses = await Promise.all(cases);
    assert.deepEqual(responses.map((response) => response.status), Array(cases.length).fill(400));
  } finally {
    await removeCard(card.id);
  }
});

test("6. user_id enviado no corpo não altera o dono do cartão", async () => {
  const { response: created, card } = await createCard({ user_id: "222" });
  try {
    assert.equal(created.status, 201);
    assert.equal(card.user_id, "111");

    const patchedResponse = await api(`/api/cartoes/${card.id}`, {
      method: "PATCH",
      token: TOKEN_A,
      body: { titulo: "Dono preservado", user_id: "222" },
    });
    assert.equal(patchedResponse.status, 200);
    const patchedCard = await patchedResponse.json();
    assert.equal(patchedCard.user_id, "111");
  } finally {
    await removeCard(card.id);
  }
});

test("7. PATCH persiste coluna e posição e GET ordena por coluna e posição", async () => {
  const cards = [];
  try {
    for (const titulo of ["Ordem A", "Ordem B", "Ordem C"]) {
      const { response, card } = await createCard({ titulo });
      assert.equal(response.status, 201);
      cards.push(card);
    }

    const updates = [
      { coluna: "a_fazer", posicao: 5 },
      { coluna: "a_fazer", posicao: 10 },
      { coluna: "em_execucao", posicao: 0 },
    ];
    for (let index = 0; index < cards.length; index += 1) {
      const response = await api(`/api/cartoes/${cards[index].id}`, {
        method: "PATCH",
        token: TOKEN_A,
        body: updates[index],
      });
      assert.equal(response.status, 200);
    }

    const listResponse = await api("/api/cartoes", { token: TOKEN_A });
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    const selected = list.filter((item) => cards.some((card) => card.id === item.id));
    assert.deepEqual(selected.map((item) => item.id), cards.map((card) => card.id));
    assert.deepEqual(selected.map((item) => [item.coluna, item.posicao]), [
      ["a_fazer", 5],
      ["a_fazer", 10],
      ["em_execucao", 0],
    ]);
  } finally {
    for (const card of cards) await removeCard(card.id);
  }
});

test("8. DELETE próprio responde 204 e remove o cartão da listagem", async () => {
  const { response: created, card } = await createCard();
  assert.equal(created.status, 201);
  const deleted = await api(`/api/cartoes/${card.id}`, { method: "DELETE", token: TOKEN_A });
  assert.equal(deleted.status, 204);
  createdCardIds.delete(card.id);

  const listResponse = await api("/api/cartoes", { token: TOKEN_A });
  const list = await listResponse.json();
  assert.equal(list.some((item) => item.id === card.id), false);
});

test("9. Títulos com SQL e HTML são armazenados e retornados como texto", async () => {
  const titles = ["'; DROP TABLE cartoes; --", "<script>alert(1)</script>"];
  const cards = [];
  try {
    for (const titulo of titles) {
      const { response, card } = await createCard({ titulo });
      assert.equal(response.status, 201);
      assert.equal(card.titulo, titulo);
      cards.push(card);
    }

    const listResponse = await api("/api/cartoes", { token: TOKEN_A });
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    for (const card of cards) {
      assert.equal(list.find((item) => item.id === card.id).titulo, card.titulo);
    }
  } finally {
    for (const card of cards) await removeCard(card.id);
  }
});

test("10. Respostas de erro não expõem stack, SQL, caminhos ou segredos", async () => {
  const responses = await Promise.all([
    api("/api/cartoes", { method: "POST", token: TOKEN_A, rawBody: "{ erro" }),
    api("/api/cartoes/nao-numerico", { method: "PATCH", token: TOKEN_A, body: { titulo: "x" } }),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 400);
    const body = await response.text();
    assert.doesNotMatch(body, /stack|sqlite|select\s|insert\s|client_secret|[A-Z]:\\/i);
  }
});

test("11. Logout invalida somente a sessão própria", async () => {
  const logout = await api("/api/sessao", { method: "DELETE", token: TOKEN_LOGOUT });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie") || "", /sessao=;[^]*Max-Age=0/i);

  const loggedOut = await api("/api/cartoes", { token: TOKEN_LOGOUT });
  const stillLoggedIn = await api("/api/cartoes", { token: TOKEN_A });
  assert.equal(loggedOut.status, 401);
  assert.equal(stillLoggedIn.status, 200);
});

test("12. OAuth2 redireciona com state e recusa callback com state divergente", async () => {
  const response = await api("/api/auth/discord", { redirect: "manual" });
  assert.equal(response.status, 302);

  const authorizationUrl = new URL(response.headers.get("location"));
  assert.equal(authorizationUrl.origin, "https://discord.com");
  assert.equal(authorizationUrl.pathname, "/api/oauth2/authorize");
  assert.equal(authorizationUrl.searchParams.get("scope"), "identify");
  assert.ok(authorizationUrl.searchParams.get("state"));

  const stateCookie = response.headers.get("set-cookie") || "";
  assert.match(stateCookie, /oauth_state=[^;]+/);
  assert.match(stateCookie, /HttpOnly/i);
  assert.match(stateCookie, /Secure/i);
  assert.match(stateCookie, /SameSite=Lax/i);
  assert.match(stateCookie, /Path=\//i);
  assert.match(stateCookie, /Max-Age=600/i);

  const callback = await api(
    "/api/auth/discord/callback?state=divergente&code=teste",
    { cookie: "oauth_state=outro-state" },
  );
  assert.equal(callback.status, 400);
});
