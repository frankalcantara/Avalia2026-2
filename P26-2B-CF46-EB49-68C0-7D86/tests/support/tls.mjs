import { execFile } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

export async function localCertificate(t) {
  const gitOpenSSL = "C:/Program Files/Git/usr/bin/openssl.exe";
  const executable = process.env.OPENSSL_PATH || (existsSync(gitOpenSSL) ? gitOpenSSL : "openssl");
  const directory = await mkdtemp(join(tmpdir(), "p23-tls-"));
  const certFile = join(directory, "cert.pem");
  const keyFile = join(directory, "key.pem");
  t.after(async () => {
    for (const file of [certFile, keyFile]) {
      await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
    await rmdir(directory);
  });
  await promisify(execFile)(executable, [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
    "-keyout", keyFile, "-out", certFile,
  ], { windowsHide: true });
  const cert = await readFile(certFile);
  const key = await readFile(keyFile);
  const pubKey = new X509Certificate(cert).publicKey.export({ type: "spki", format: "der" });
  return { cert, key, tlsPin: createHash("sha256").update(pubKey).digest("base64") };
}
