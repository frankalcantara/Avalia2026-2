import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bind, migration } from "./database.mjs";

export const oauthMigration = readFileSync(new URL("../../migrations/0003_oauth_attempts.sql", import.meta.url), "utf8");
export const callbackPath = "/api/auth/discord/callback";
export const startPath = "/api/auth/discord";

export function prepareOAuthDatabase(sqlite) {
  sqlite.exec(migration);
  sqlite.exec(oauthMigration);
}

export function oauthEnvironment(sqlite, origin) {
  return {
    DB: bind(sqlite),
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: "fixture-discord-client-secret",
    DISCORD_REDIRECT_URI: origin + callbackPath,
  };
}

export function mockDiscord(t, identity, { tokenStatus = 200, profileStatus = 200, allowLocal = false } = {}) {
  const outbound = [];
  const fetchReal = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (allowLocal && url.hostname === "127.0.0.1") return fetchReal(input, options);
    assert.equal(url.origin, "https://discord.com");
    switch (url.pathname) {
      case "/api/oauth2/token": {
        const form = new URLSearchParams(options.body);
        outbound.push({ path: "token", method: options.method, form });
        return Response.json(tokenStatus === 200 ? { access_token: "fixture-token", token_type: "Bearer", scope: "identify" } : {}, { status: tokenStatus });
      }
      case "/api/v10/users/@me": {
        outbound.push({ path: "identity" });
        assert.equal(new Headers(options.headers).get("Authorization"), "Bearer fixture-token");
        return Response.json(profileStatus === 200 ? identity() : {}, { status: profileStatus });
      }
      default:
        throw new Error("Unexpected provider path: " + url.pathname);
    }
  });
  return outbound;
}
