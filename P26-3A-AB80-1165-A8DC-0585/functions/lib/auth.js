
/**
 * DevGratitude - Projeto #29
 * Chave: P26-3A-AB80-1165-A8DC-0585
 *
 * Validação compartilhada da sessão Discord.
 */

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";

  const entry = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="));

  return entry
    ? entry.slice(name.length + 1)
    : null;
}

function decodeBase64Url(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const binary = atob(base64);

  return Uint8Array.from(
    binary,
    (char) => char.charCodeAt(0)
  );
}

export async function verifySession(request, secret) {
  if (!secret) return null;

  const cookie = getCookie(
    request,
    "discord_session"
  );

  if (!cookie) return null;

  const parts = cookie.split(".");

  if (parts.length !== 2) return null;

  const [payload, signature] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(payload)
    );

    if (!valid) return null;

    const session = JSON.parse(
      new TextDecoder().decode(
        decodeBase64Url(payload)
      )
    );

    if (
      !session.userId ||
      !session.exp ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      userId: String(session.userId),
      username: String(session.username || ""),
      avatar: String(session.avatar || "")
    };
  } catch {
    return null;
  }
}
