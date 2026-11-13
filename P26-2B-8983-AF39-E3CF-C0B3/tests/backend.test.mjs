import assert from "node:assert/strict";
import test from "node:test";
import { HttpError, listRecipes, validateRecipe } from "../functions/_utils.js";
import { onRequest as discordLogin } from "../functions/api/auth/discord.js";
import { onRequest as discordCallback } from "../functions/api/auth/discord/callback.js";
import { onRequest as authMe } from "../functions/api/auth/me.js";
import { onRequest as logout } from "../functions/api/auth/logout.js";
import { onRequest as favoriteRequest } from "../functions/api/favorites/[recipeId].js";
import { onRequest as favoritesList } from "../functions/api/favorites/index.js";
import { onRequest as recipesRequest } from "../functions/api/recipes/index.js";
import { onRequest as statusRequest } from "../functions/api/status.js";

const validRecipe = {
  title: "PÃO de queijo",
  description: "",
  prepTime: 30,
  servings: 2,
  ingredients: [{ name: "Farinha", quantity: 2, unit: "xícaras" }],
  steps: ["Misture os ingredientes."],
};

test("recipe title search normalizes Portuguese accents before binding SQL", async () => {
  let statement;
  const db = {
    prepare(sql) {
      statement = { sql, values: [] };
      return {
        bind(...values) {
          statement.values = values;
          return this;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };

  await listRecipes(db, "viewer-id", { q: "PÃO" });

  assert.match(statement.sql, /r\.title_key LIKE/);
  assert.equal(statement.values[1], "%pão%");
});

test("recipe creation validation rejects non-positive ingredient quantities", () => {
  assert.throws(
    () => validateRecipe({ ...validRecipe, ingredients: [{ name: "Farinha", quantity: 0, unit: "g" }] }),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("favorite mutations require a Discord session before accessing D1", async () => {
  let databaseAccessed = false;
  const response = await favoriteRequest({
    request: new Request("https://example.test/api/favorites/00000000-0000-4000-8000-000000000001", {
      method: "POST",
    }),
    params: { recipeId: "00000000-0000-4000-8000-000000000001" },
    env: {
      DB: {
        prepare() {
          databaseAccessed = true;
          throw new Error("Database should not be reached");
        },
      },
    },
  });

  assert.equal(response.status, 401);
  assert.equal(databaseAccessed, false);
});

test("Discord callback rejects a mismatched OAuth state", async () => {
  const response = await discordCallback({
    request: new Request("https://example.test/api/auth/discord/callback?code=example&state=attacker", {
      headers: { Cookie: "__Host-discord_oauth_state=expected" },
    }),
    env: {},
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "OAuth state validation failed" });
});

test("Discord login reports missing credentials instead of redirecting", async () => {
  const response = await discordLogin({
    request: new Request("https://example.test/api/auth/discord"),
    env: {},
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Discord OAuth2 credentials are not configured" });
});

test("session endpoint returns an anonymous user when no cookie is present", async () => {
  const response = await authMe({
    request: new Request("https://example.test/api/auth/me"),
    env: {},
  });

  assert.deepEqual(await response.json(), { user: null });
});

test("logout clears the signed session cookie", async () => {
  const response = await logout({
    request: new Request("https://example.test/api/auth/logout", { method: "POST" }),
    env: {},
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("recipe list reports missing D1 and favorites list requires a session", async () => {
  const request = new Request("https://example.test/api/recipes");
  const recipeResponse = await recipesRequest({ request, env: {} });
  const favoritesResponse = await favoritesList({
    request: new Request("https://example.test/api/favorites"),
    env: {},
  });

  assert.equal(recipeResponse.status, 503);
  assert.equal(favoritesResponse.status, 401);
});

test("public status endpoint reports D1 health without user records", async () => {
  const response = await statusRequest({
    request: new Request("https://example.test/api/status"),
    env: {
      DB: {
        prepare(sql) {
          assert.equal(sql, "SELECT 1 AS ok");
          return { first: async () => ({ ok: 1 }) };
        },
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, d1Connected: true });
});

test("status endpoint reports missing D1 configuration as unavailable", async () => {
  const response = await statusRequest({
    request: new Request("https://example.test/api/status"),
    env: {},
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "D1 database is not configured" });
});
