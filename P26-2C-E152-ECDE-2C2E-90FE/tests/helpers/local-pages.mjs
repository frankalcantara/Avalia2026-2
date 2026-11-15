import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const wranglerEntry = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");

export async function makeTempWorkspace(prefix = "soundroom-local-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  return {
    root,
    persist: path.join(root, "d1"),
    async cleanup() {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await rm(root, { recursive: true, force: true });
          return;
        } catch (error) {
          if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(error?.code) || attempt >= 8) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
    },
  };
}

export function runWrangler(args, { timeout = 120_000 } = {}) {
  const result = spawnSync(process.execPath, [wranglerEntry, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `wrangler ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

export async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

export async function startPages({ persist, port }) {
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [
    wranglerEntry,
    "pages",
    "dev",
    "./public",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--persist-to",
    persist,
    "--binding",
    `APP_URL=${origin}`,
    "--binding",
    "SPOTIFY_CLIENT_ID=",
    "--binding",
    "SPOTIFY_CLIENT_SECRET=",
    "--log-level",
    "error",
  ], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { output = `${output}${chunk}`.slice(-16_000); });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { output = `${output}${chunk}`.slice(-16_000); });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local Pages exited with code ${child.exitCode}\n${output}`);
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) {
        return {
          child,
          origin,
          output: () => output,
          async stop() {
            if (child.exitCode !== null) return;
            const exited = new Promise((resolve) => child.once("exit", resolve));
            child.kill("SIGINT");
            await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 8000))]);
            if (child.exitCode === null) {
              child.kill();
              await exited;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          },
        };
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  child.kill();
  throw new Error(`Local Pages did not become ready\n${output}`);
}

export function applyLocalMigrations(persist) {
  runWrangler([
    "d1",
    "migrations",
    "apply",
    "soundroom",
    "--local",
    "--persist-to",
    persist,
  ]);
}

export function executeLocalSql(persist, sql) {
  return runWrangler([
    "d1",
    "execute",
    "soundroom",
    "--local",
    "--persist-to",
    persist,
    "--command",
    sql,
    "--json",
  ]);
}
