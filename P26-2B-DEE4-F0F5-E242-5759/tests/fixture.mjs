import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createSession } from "../functions/_shared/session.js";
import * as auth from "../functions/api/auth/discord.js";
import * as callback from "../functions/api/auth/discord/callback.js";
import * as status from "../functions/api/status.js";
import * as rides from "../functions/api/rides.js";
import * as mine from "../functions/api/rides/mine.js";
import * as detail from "../functions/api/rides/[id].js";

export async function fixture() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0001_init", "0002_caronas"]) {
    db.exec(readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8"));
  }
  db.exec("INSERT INTO discord_users (user_id, username) VALUES ('1','Motorista'),('2','Passageiro'),('3','Colega')");
  const env = {
    DISCORD_CLIENT_ID: "fixture",
    DISCORD_CLIENT_SECRET: "fixture",
    SESSION_SECRET: "fixture-secret-for-local-tests-only",
    DB: {
      prepare(sql) {
        const statement = db.prepare(sql);
        function bind(...args) {
          return {
            first: async () => statement.get(...args) ?? null,
            all: async () => ({ results: statement.all(...args) }),
            run: async () => statement.run(...args),
          };
        }
        return { ...bind(), bind };
      },
    },
  };
  const cookies = {};
  for (const id of ["1", "2", "3"]) cookies[id] = (await createSession(env, id)).split(";")[0];

  async function dispatch(request) {
    const { pathname } = new URL(request.url);
    const routes = {
      "/api/auth/discord": auth, "/api/auth/discord/callback": callback,
      "/api/status": status, "/api/rides": rides, "/api/rides/mine": mine,
    };
    const id = pathname.match(/^\/api\/rides\/([^/]+)$/)?.[1];
    const handlers = routes[pathname] ?? (id ? detail : undefined);
    const method = request.method.toLowerCase();
    const handler = handlers?.["onRequest" + method[0].toUpperCase() + method.slice(1)];
    return handler ? handler({ request, env, params: { id } }) : new Response(null, { status: 405 });
  }

  function call(path, { method = "GET", user, cookie = cookies[user], body, origin } = {}) {
    const headers = new Headers();
    if (cookie) headers.set("Cookie", cookie);
    if (origin) headers.set("Origin", origin);
    return dispatch(new Request("https://fixture.test" + path, { method, headers, body }));
  }

  return { db, env, cookies, dispatch, call };
}
