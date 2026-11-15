const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";
const MAX_RESPONSE_BYTES = 524288;
const MAX_ERROR_RESPONSE_BYTES = 16384;
const REQUEST_TIMEOUT_MS = 6000;

const cachedTokens = new Map();
const tokenRequests = new Map();

export class MusicProviderError extends Error {
  constructor(status, code, message, retryAfter = null) {
    super(message);
    this.name = "MusicProviderError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function providerUnavailable() {
  return new MusicProviderError(
    503,
    "MUSIC_PROVIDER_UNAVAILABLE",
    "O catálogo do Spotify está temporariamente indisponível.",
  );
}

function retryAfterSeconds(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 3600) : null;
}

function safeSpotifyErrorCode(body) {
  const code = typeof body?.error === "string"
    ? body.error
    : body?.error?.code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(code)
    ? code
    : null;
}

function logDiagnostic(stage, status, category, spotifyErrorCode = null) {
  const details = { stage, category };
  if (Number.isInteger(status)) details.status = status;
  if (spotifyErrorCode) details.spotifyErrorCode = spotifyErrorCode;
  console.error("Spotify provider failure", details);
}

function httpFailureCategory(status, spotifyErrorCode) {
  if (status === 401 || spotifyErrorCode === "invalid_client") return "authentication";
  if (status === 403) return "access_denied";
  if (status === 429) return "rate_limited";
  return "http_error";
}

function networkFailureCategory(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError"
    ? "timeout"
    : "network_error";
}

async function logHttpFailure(stage, response) {
  let spotifyErrorCode = null;
  try {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength <= MAX_ERROR_RESPONSE_BYTES) {
      spotifyErrorCode = safeSpotifyErrorCode(JSON.parse(text));
    }
  } catch {
    spotifyErrorCode = null;
  }
  logDiagnostic(
    stage,
    response.status,
    httpFailureCategory(response.status, spotifyErrorCode),
    spotifyErrorCode,
  );
  return spotifyErrorCode;
}

async function readJson(response, stage) {
  let text;
  try {
    text = await response.text();
  } catch {
    logDiagnostic(stage, response.status, "network_error");
    throw providerUnavailable();
  }
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    logDiagnostic(stage, response.status, "invalid_response");
    throw providerUnavailable();
  }
  try {
    return JSON.parse(text);
  } catch {
    logDiagnostic(stage, response.status, "invalid_response");
    throw providerUnavailable();
  }
}

function credentials(env) {
  const clientId = env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new MusicProviderError(
      503,
      "MUSIC_PROVIDER_NOT_CONFIGURED",
      "Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no servidor.",
    );
  }
  return { clientId, clientSecret };
}

function isUsableToken(token) {
  return token && token.expiresAt > Date.now();
}

async function credentialCacheKey(clientId, clientSecret) {
  const encoded = new TextEncoder().encode(JSON.stringify([clientId, clientSecret]));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchAccessToken(env) {
  const { clientId, clientSecret } = credentials(env);
  const cacheKey = await credentialCacheKey(clientId, clientSecret);
  const cachedToken = cachedTokens.get(cacheKey);
  if (isUsableToken(cachedToken)) {
    return cachedToken;
  }
  const pendingRequest = tokenRequests.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    let response;
    try {
      response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      logDiagnostic("token", null, networkFailureCategory(error));
      throw providerUnavailable();
    }

    if (response.status === 429) {
      await logHttpFailure("token", response);
      throw new MusicProviderError(
        503,
        "MUSIC_PROVIDER_RATE_LIMITED",
        "O Spotify limitou temporariamente as consultas.",
        retryAfterSeconds(response.headers.get("Retry-After")),
      );
    }
    if (!response.ok) {
      await logHttpFailure("token", response);
      throw providerUnavailable();
    }

    const body = await readJson(response, "token");
    if (
      typeof body?.access_token !== "string"
      || body.access_token.length < 16
      || body.access_token.length > 4096
      || typeof body.expires_in !== "number"
      || !Number.isFinite(body.expires_in)
      || body.expires_in < 60
      || body.expires_in > 86400
      || typeof body.token_type !== "string"
      || body.token_type.toLowerCase() !== "bearer"
    ) {
      logDiagnostic("token", response.status, "invalid_response");
      throw providerUnavailable();
    }

    const token = {
      cacheKey,
      value: body.access_token,
      expiresAt: Date.now() + Math.max(0, body.expires_in - 30) * 1000,
    };
    cachedTokens.set(cacheKey, token);
    return token;
  })();

  tokenRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (tokenRequests.get(cacheKey) === request) {
      tokenRequests.delete(cacheKey);
    }
  }
}

function safeImageUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.hostname !== "i.scdn.co"
      || url.username
      || url.password
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function normalizedTrack(item) {
  if (
    !item
    || item.type !== "track"
    || typeof item.id !== "string"
    || !/^[A-Za-z0-9]{22}$/u.test(item.id)
    || typeof item.name !== "string"
    || !item.name.trim()
    || item.name.trim().length > 200
  ) {
    return null;
  }
  const artists = Array.isArray(item.artists)
    ? item.artists
      .filter((artist) => typeof artist?.name === "string" && artist.name.trim())
      .map((artist) => artist.name.trim())
    : [];
  const artist = artists.join(", ");
  if (!artist || artist.length > 160) return null;

  const albumName = typeof item.album?.name === "string" && item.album.name.trim()
    ? item.album.name.trim().slice(0, 200)
    : null;
  const images = Array.isArray(item.album?.images) ? item.album.images : [];
  const coverImageUrl = images
    .map((image) => safeImageUrl(image?.url))
    .find(Boolean) ?? null;
  const durationMs = Number.isInteger(item.duration_ms)
    && item.duration_ms >= 0
    && item.duration_ms <= 86400000
    ? item.duration_ms
    : null;
  return {
    id: item.id,
    title: item.name.trim(),
    artist,
    album: albumName,
    coverImageUrl,
    durationMs,
    externalUrl: `https://open.spotify.com/track/${item.id}`,
  };
}

async function fetchTrackPayload(env, url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await fetchAccessToken(env);
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token.value}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      logDiagnostic("catalog", null, networkFailureCategory(error));
      throw providerUnavailable();
    }

    if (response.status === 401) {
      await logHttpFailure("catalog", response);
      if (attempt === 0) {
        const cachedToken = cachedTokens.get(token.cacheKey);
        if (cachedToken?.value === token.value) {
          cachedTokens.delete(token.cacheKey);
        }
        continue;
      }
      throw providerUnavailable();
    }
    if (response.status === 429) {
      await logHttpFailure("catalog", response);
      throw new MusicProviderError(
        503,
        "MUSIC_PROVIDER_RATE_LIMITED",
        "O Spotify limitou temporariamente as consultas.",
        retryAfterSeconds(response.headers.get("Retry-After")),
      );
    }
    if (!response.ok) {
      await logHttpFailure("catalog", response);
      throw providerUnavailable();
    }
    return readJson(response, "catalog");
  }
  throw providerUnavailable();
}

export async function searchSpotifyTracks(env, { query, limit, offset }) {
  const url = new URL(`${API_URL}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("market", "BR");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  const payload = await fetchTrackPayload(env, url);
  if (
    !Array.isArray(payload?.tracks?.items)
    || !Number.isInteger(payload.tracks.total)
    || payload.tracks.total < 0
  ) {
    logDiagnostic("catalog", 200, "invalid_response");
    throw providerUnavailable();
  }
  return {
    tracks: payload.tracks.items.map(normalizedTrack).filter(Boolean),
    total: payload.tracks.total,
  };
}

export async function fetchSpotifyTrack(env, trackId) {
  if (typeof trackId !== "string" || !/^[A-Za-z0-9]{22}$/u.test(trackId)) {
    throw new MusicProviderError(
      400,
      "INVALID_TRACK",
      "Selecione uma música válida do Spotify.",
    );
  }
  const payload = await fetchTrackPayload(env, `${API_URL}/tracks/${trackId}?market=BR`);
  const track = normalizedTrack(payload);
  if (!track) {
    logDiagnostic("catalog", 200, "invalid_response");
    throw providerUnavailable();
  }
  return track;
}

export function clearSpotifyTokenCache() {
  cachedTokens.clear();
  tokenRequests.clear();
}
