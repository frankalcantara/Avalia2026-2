import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../../functions/api/health.js";

test("GET /api/health returns the SoundRoom health payload", async () => {
  const response = await onRequest({
    request: new Request("http://localhost/api/health"),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "soundroom" });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("health rejects methods other than GET", async () => {
  for (const method of ["POST", "PUT", "DELETE", "HEAD"]) {
    const response = await onRequest({
      request: new Request("http://localhost/api/health", { method }),
    });

    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("Allow"), "GET");
    assert.equal((await response.json()).error.code, "METHOD_NOT_ALLOWED");
  }
});
