import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSpotifyTokenCache,
  fetchSpotifyTrack,
  MusicProviderError,
  searchSpotifyTracks,
} from "../../functions/_shared/music/providers/spotify.js";

const trackId = "AbCdEfGhIjKlMnOpQrStUv";
const track = {
  id: trackId,
  type: "track",
  name: "Som de teste",
  artists: [{ name: "Artista de teste" }],
  album: {
    name: "Álbum de teste",
    images: [{ url: "https://i.scdn.co/image/test-cover" }],
  },
  duration_ms: 180000,
};

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function mockFetch(implementation, onDiagnostic = () => {}) {
  const original = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = implementation;
  console.error = (...args) => onDiagnostic(...args);
  return () => {
    globalThis.fetch = original;
    console.error = originalConsoleError;
    clearSpotifyTokenCache();
  };
}

test("Spotify credentials are required before any external request", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return jsonResponse({});
  });
  try {
    await assert.rejects(
      searchSpotifyTracks({}, { query: "test", limit: 10, offset: 0 }),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_NOT_CONFIGURED",
    );
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("search normalizes catalog metadata and only uses approved Spotify hosts", async () => {
  const calls = [];
  const restore = mockFetch(async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/api/token")) {
      return jsonResponse({ access_token: "unit-test-access-token", expires_in: 3600, token_type: "bearer" });
    }
    return jsonResponse({ tracks: { total: 1, items: [track] } });
  });
  try {
    const result = await searchSpotifyTracks(
      { SPOTIFY_CLIENT_ID: "test-client", SPOTIFY_CLIENT_SECRET: "test-secret" },
      { query: "som", limit: 10, offset: 0 },
    );

    assert.equal(result.total, 1);
    assert.deepEqual(result.tracks[0], {
      id: trackId,
      title: "Som de teste",
      artist: "Artista de teste",
      album: "Álbum de teste",
      coverImageUrl: "https://i.scdn.co/image/test-cover",
      durationMs: 180000,
      externalUrl: `https://open.spotify.com/track/${trackId}`,
    });
    assert.equal(new URL(calls[1].url).hostname, "api.spotify.com");
    assert.equal(new URL(calls[1].url).searchParams.get("market"), "BR");
    assert.match(calls[0].options.headers.Authorization, /^Basic /u);
  } finally {
    restore();
  }
});

test("Spotify reuses a valid application token for multiple catalog requests", async () => {
  let tokenRequests = 0;
  let apiRequests = 0;
  const restore = mockFetch(async (url) => {
    if (String(url).includes("/api/token")) {
      tokenRequests += 1;
      return jsonResponse({
        access_token: "unit-test-cached-access-token",
        expires_in: 3600,
        token_type: "bearer",
      });
    }
    apiRequests += 1;
    return jsonResponse(track);
  });
  try {
    const env = { SPOTIFY_CLIENT_ID: "test-client", SPOTIFY_CLIENT_SECRET: "test-secret" };
    const first = await fetchSpotifyTrack(env, trackId);
    const second = await fetchSpotifyTrack(env, trackId);

    assert.equal(first.id, trackId);
    assert.equal(second.id, trackId);
    assert.equal(tokenRequests, 1);
    assert.equal(apiRequests, 2);
  } finally {
    restore();
  }
});

test("Spotify token cache is isolated by the full credential pair", async () => {
  let tokenRequests = 0;
  const restore = mockFetch(async (url) => {
    if (String(url).includes("/api/token")) {
      tokenRequests += 1;
      return jsonResponse({
        access_token: `unit-test-isolated-token-${tokenRequests}`,
        expires_in: 3600,
        token_type: "bearer",
      });
    }
    return jsonResponse(track);
  });
  try {
    const firstCredentials = {
      SPOTIFY_CLIENT_ID: "same-client",
      SPOTIFY_CLIENT_SECRET: "first-secret",
    };
    const secondCredentials = {
      SPOTIFY_CLIENT_ID: "same-client",
      SPOTIFY_CLIENT_SECRET: "second-secret",
    };
    await fetchSpotifyTrack(firstCredentials, trackId);
    await fetchSpotifyTrack(secondCredentials, trackId);
    await fetchSpotifyTrack(firstCredentials, trackId);
    await fetchSpotifyTrack(secondCredentials, trackId);

    assert.equal(tokenRequests, 2);
  } finally {
    restore();
  }
});

test("simultaneous Spotify requests with different credentials do not share token requests", async () => {
  let tokenRequests = 0;
  let releaseTokenRequests;
  let resolveBothStarted;
  const tokenGate = new Promise((resolve) => {
    releaseTokenRequests = resolve;
  });
  const bothStarted = new Promise((resolve) => {
    resolveBothStarted = resolve;
  });
  const restore = mockFetch(async (url) => {
    if (String(url).includes("/api/token")) {
      tokenRequests += 1;
      if (tokenRequests === 2) resolveBothStarted(true);
      await tokenGate;
      return jsonResponse({
        access_token: `unit-test-concurrent-token-${tokenRequests}`,
        expires_in: 3600,
        token_type: "bearer",
      });
    }
    return jsonResponse(track);
  });
  try {
    const firstRequest = fetchSpotifyTrack(
      { SPOTIFY_CLIENT_ID: "first-client", SPOTIFY_CLIENT_SECRET: "first-secret" },
      trackId,
    );
    const secondRequest = fetchSpotifyTrack(
      { SPOTIFY_CLIENT_ID: "second-client", SPOTIFY_CLIENT_SECRET: "second-secret" },
      trackId,
    );
    const timeout = setTimeout(() => resolveBothStarted(false), 500);
    const bothRequestsStarted = await bothStarted;
    clearTimeout(timeout);
    releaseTokenRequests();
    await Promise.all([firstRequest, secondRequest]);

    assert.equal(bothRequestsStarted, true);
    assert.equal(tokenRequests, 2);
  } finally {
    releaseTokenRequests();
    restore();
  }
});

test("a Spotify 401 refreshes the token once and retries the catalog request", async () => {
  let tokenRequests = 0;
  let apiRequests = 0;
  const authorizationHeaders = [];
  const restore = mockFetch(async (url, options) => {
    if (String(url).includes("/api/token")) {
      tokenRequests += 1;
      return jsonResponse({
        access_token: `unit-test-access-token-${tokenRequests}`,
        expires_in: 3600,
        token_type: "bearer",
      });
    }
    apiRequests += 1;
    authorizationHeaders.push(options.headers.Authorization);
    return apiRequests === 1
      ? jsonResponse({ error: "expired" }, 401)
      : jsonResponse(track);
  });
  try {
    const result = await fetchSpotifyTrack(
      { SPOTIFY_CLIENT_ID: "test-client", SPOTIFY_CLIENT_SECRET: "test-secret" },
      trackId,
    );
    assert.equal(result.id, trackId);
    assert.equal(tokenRequests, 2);
    assert.equal(apiRequests, 2);
    assert.deepEqual(authorizationHeaders, [
      "Bearer unit-test-access-token-1",
      "Bearer unit-test-access-token-2",
    ]);
  } finally {
    restore();
  }
});

test("Spotify token authentication failures are diagnosed without exposing credentials", async () => {
  const diagnostics = [];
  const clientId = "unit-test-client-id";
  const clientSecret = "unit-test-client-secret";
  const privateDescription = "private-error-description";
  const restore = mockFetch(async () => jsonResponse({
    error: "invalid_client",
    error_description: privateDescription,
  }, 401), (...args) => diagnostics.push(args));
  try {
    await assert.rejects(
      fetchSpotifyTrack(
        { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret },
        trackId,
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_UNAVAILABLE",
    );

    assert.deepEqual(diagnostics[0], ["Spotify provider failure", {
      stage: "token",
      category: "authentication",
      status: 401,
      spotifyErrorCode: "invalid_client",
    }]);
    const logged = JSON.stringify(diagnostics);
    assert.equal(logged.includes(clientId), false);
    assert.equal(logged.includes(clientSecret), false);
    assert.equal(logged.includes(privateDescription), false);
  } finally {
    restore();
  }
});

test("repeated Spotify 401 responses stop after one token refresh", async () => {
  let tokenRequests = 0;
  let apiRequests = 0;
  const restore = mockFetch(async (url) => {
    if (String(url).includes("/api/token")) {
      tokenRequests += 1;
      return jsonResponse({
        access_token: `unit-test-access-token-${tokenRequests}`,
        expires_in: 3600,
        token_type: "bearer",
      });
    }
    apiRequests += 1;
    return jsonResponse({ error: "unauthorized" }, 401);
  });
  try {
    await assert.rejects(
      fetchSpotifyTrack(
        { SPOTIFY_CLIENT_ID: "test-client", SPOTIFY_CLIENT_SECRET: "test-secret" },
        trackId,
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_UNAVAILABLE",
    );
    assert.equal(tokenRequests, 2);
    assert.equal(apiRequests, 2);
  } finally {
    restore();
  }
});

test("Spotify catalog 403 is diagnosed as access denied and stays generic to callers", async () => {
  const diagnostics = [];
  const clientId = "unit-test-403-client";
  const clientSecret = "unit-test-403-secret";
  const accessToken = "unit-test-403-access-token";
  const restore = mockFetch(async (url) => (
    String(url).includes("/api/token")
      ? jsonResponse({ access_token: accessToken, expires_in: 3600, token_type: "bearer" })
      : jsonResponse({ error: { status: 403, code: "access_denied" } }, 403)
  ), (...args) => diagnostics.push(args));
  try {
    await assert.rejects(
      searchSpotifyTracks(
        { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret },
        { query: "som", limit: 10, offset: 0 },
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_UNAVAILABLE"
        && error.message === "O catálogo do Spotify está temporariamente indisponível.",
    );

    assert.deepEqual(diagnostics[0], ["Spotify provider failure", {
      stage: "catalog",
      category: "access_denied",
      status: 403,
      spotifyErrorCode: "access_denied",
    }]);
    const logged = JSON.stringify(diagnostics);
    assert.equal(logged.includes(clientId), false);
    assert.equal(logged.includes(clientSecret), false);
    assert.equal(logged.includes(accessToken), false);
  } finally {
    restore();
  }
});

test("Spotify 429 is surfaced as a bounded retry delay", async () => {
  const diagnostics = [];
  const restore = mockFetch(async (url) => (
    String(url).includes("/api/token")
      ? jsonResponse({ access_token: "unit-test-access-token", expires_in: 3600, token_type: "bearer" })
      : jsonResponse({ error: "rate_limited" }, 429, { "Retry-After": "42" })
  ), (...args) => diagnostics.push(args));
  try {
    await assert.rejects(
      searchSpotifyTracks(
        { SPOTIFY_CLIENT_ID: "test-client", SPOTIFY_CLIENT_SECRET: "test-secret" },
        { query: "som", limit: 10, offset: 0 },
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_RATE_LIMITED"
        && error.retryAfter === 42,
    );
    assert.deepEqual(diagnostics[0], ["Spotify provider failure", {
      stage: "catalog",
      category: "rate_limited",
      status: 429,
      spotifyErrorCode: "rate_limited",
    }]);
  } finally {
    restore();
  }
});

test("Spotify network failures are diagnosed by stage without logging error details", async () => {
  const diagnostics = [];
  const clientId = "unit-test-network-client";
  const clientSecret = "unit-test-network-secret";
  const privateNetworkError = "private-network-error-detail";
  const restore = mockFetch(async (url) => {
    if (String(url).includes("/api/token")) {
      return jsonResponse({ access_token: "unit-test-network-access-token", expires_in: 3600, token_type: "bearer" });
    }
    throw new TypeError(privateNetworkError);
  }, (...args) => diagnostics.push(args));
  try {
    await assert.rejects(
      searchSpotifyTracks(
        { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret },
        { query: "som", limit: 10, offset: 0 },
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_UNAVAILABLE",
    );

    assert.deepEqual(diagnostics[0], ["Spotify provider failure", {
      stage: "catalog",
      category: "network_error",
    }]);
    const logged = JSON.stringify(diagnostics);
    assert.equal(logged.includes(clientId), false);
    assert.equal(logged.includes(clientSecret), false);
    assert.equal(logged.includes(privateNetworkError), false);
  } finally {
    restore();
  }
});

test("Spotify timeouts are diagnosed without including exception details", async () => {
  const diagnostics = [];
  const timeout = new Error("private-timeout-detail");
  timeout.name = "TimeoutError";
  const restore = mockFetch(async () => {
    throw timeout;
  }, (...args) => diagnostics.push(args));
  try {
    await assert.rejects(
      fetchSpotifyTrack(
        { SPOTIFY_CLIENT_ID: "unit-test-timeout-client", SPOTIFY_CLIENT_SECRET: "unit-test-timeout-secret" },
        trackId,
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_UNAVAILABLE",
    );
    assert.deepEqual(diagnostics[0], ["Spotify provider failure", {
      stage: "token",
      category: "timeout",
    }]);
    assert.equal(JSON.stringify(diagnostics).includes("private-timeout-detail"), false);
  } finally {
    restore();
  }
});

test("Spotify token endpoint 429 is reported without a catalog request", async () => {
  let apiRequests = 0;
  const diagnostics = [];
  const restore = mockFetch(async (url) => {
    if (String(url).includes("/api/token")) {
      return jsonResponse({ error: "rate_limited" }, 429, { "Retry-After": "7200" });
    }
    apiRequests += 1;
    return jsonResponse(track);
  }, (...args) => diagnostics.push(args));
  try {
    await assert.rejects(
      fetchSpotifyTrack(
        { SPOTIFY_CLIENT_ID: "test-client", SPOTIFY_CLIENT_SECRET: "test-secret" },
        trackId,
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_RATE_LIMITED"
        && error.retryAfter === 3600,
    );
    assert.equal(apiRequests, 0);
    assert.deepEqual(diagnostics[0], ["Spotify provider failure", {
      stage: "token",
      category: "rate_limited",
      status: 429,
      spotifyErrorCode: "rate_limited",
    }]);
  } finally {
    restore();
  }
});

test("invalid Spotify JSON responses are diagnosed without exposing response bodies", async () => {
  const diagnostics = [];
  const privateBody = "private-provider-response";
  const restore = mockFetch(async (url) => (
    String(url).includes("/api/token")
      ? jsonResponse({ access_token: "unit-test-invalid-json-access-token", expires_in: 3600, token_type: "bearer" })
      : new Response(`not-json-${privateBody}`, { status: 200 })
  ), (...args) => diagnostics.push(args));
  try {
    await assert.rejects(
      searchSpotifyTracks(
        { SPOTIFY_CLIENT_ID: "unit-test-invalid-json-client", SPOTIFY_CLIENT_SECRET: "unit-test-invalid-json-secret" },
        { query: "som", limit: 10, offset: 0 },
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 503
        && error.code === "MUSIC_PROVIDER_UNAVAILABLE",
    );
    assert.deepEqual(diagnostics[0], ["Spotify provider failure", {
      stage: "catalog",
      category: "invalid_response",
      status: 200,
    }]);
    assert.equal(JSON.stringify(diagnostics).includes(privateBody), false);
  } finally {
    restore();
  }
});

test("track lookup rejects malformed IDs before making a request", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return jsonResponse({});
  });
  try {
    await assert.rejects(
      fetchSpotifyTrack(
        { SPOTIFY_CLIENT_ID: "test-client", SPOTIFY_CLIENT_SECRET: "test-secret" },
        "not-a-track-id",
      ),
      (error) => error instanceof MusicProviderError
        && error.status === 400
        && error.code === "INVALID_TRACK",
    );
    assert.equal(called, false);
  } finally {
    restore();
  }
});
