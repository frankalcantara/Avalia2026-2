import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  applyLocalMigrations,
  executeLocalSql,
  makeTempWorkspace,
  reservePort,
  startPages,
} from "../helpers/local-pages.mjs";

const tokenOwner = "soundroom-test-owner-session";
const tokenMember = "soundroom-test-member-session";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function seedSessions(persist) {
  const ownerHash = sha256(tokenOwner);
  const memberHash = sha256(tokenMember);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const sql = `
    INSERT INTO users (id, discord_id, display_name, created_at, updated_at)
    VALUES
      ('test-owner', '12345678901234567', 'Pessoa dona', '${createdAt}', '${createdAt}'),
      ('test-member', '12345678901234568', 'Pessoa participante', '${createdAt}', '${createdAt}');
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES
      ('${ownerHash}', 'test-owner', '${createdAt}', '${expiresAt}'),
      ('${memberHash}', 'test-member', '${createdAt}', '${expiresAt}');
  `;
  executeLocalSql(persist, sql);

  const cacheKey = sha256("cache-check\n10\n0\nBR");
  const cacheResponse = JSON.stringify({
    provider: "spotify",
    tracks: [],
    pagination: {
      query: "cache-check",
      limit: 10,
      offset: 0,
      total: 0,
      hasMore: false,
      nextOffset: null,
    },
  });
  const cacheExpires = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  executeLocalSql(
    persist,
    `INSERT INTO music_search_cache (cache_key, response_json, created_at, expires_at) VALUES ('${cacheKey}', '${cacheResponse}', '${createdAt}', '${cacheExpires}')`,
  );
}

function jsonRequest(origin, method, token, body) {
  const headers = {
    Origin: origin,
    ...(token ? { Cookie: `soundroom_session=${token}` } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  };
  return {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

test("Pages, sessions, rooms, recommendations, voting, history, and local cache work end to end", async () => {
  const workspace = await makeTempWorkspace("soundroom-integration-");
  let server;
  try {
    applyLocalMigrations(workspace.persist);
    const port = await reservePort();
    server = await startPages({ persist: workspace.persist, port });
    await seedSessions(workspace.persist);

    const { origin } = server;
    const ownerOptions = (method, body) => jsonRequest(origin, method, tokenOwner, body);
    const memberOptions = (method, body) => jsonRequest(origin, method, tokenMember, body);

    const session = await fetch(`${origin}/api/auth/me`, {
      headers: { Cookie: `soundroom_session=${tokenOwner}` },
    });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).user.displayName, "Pessoa dona");

    const invalidSession = await fetch(`${origin}/api/auth/me`, {
      headers: { Cookie: "soundroom_session=not-a-valid-session" },
    });
    assert.deepEqual(await invalidSession.json(), { user: null });

    const unauthenticated = await fetch(`${origin}/api/rooms`, {
      ...jsonRequest(origin, "POST", null, { name: "Não deve criar" }),
    });
    assert.equal(unauthenticated.status, 401);

    const createdResponse = await fetch(
      `${origin}/api/rooms`,
      ownerOptions("POST", {
        name: "Sala de integração",
        description: "Fluxo local de recuperação",
        category: "Estudo e programação",
        visibility: "public",
      }),
    );
    assert.equal(createdResponse.status, 201);
    const room = (await createdResponse.json()).room;
    assert.equal(room.isParticipant, true);

    const listed = await fetch(`${origin}/api/rooms?limit=20&offset=0`);
    assert.equal(listed.status, 200);
    assert.ok((await listed.json()).rooms.some((item) => item.id === room.id));

    const concurrentJoins = await Promise.all([
      fetch(`${origin}/api/rooms/${room.id}/join`, memberOptions("POST")),
      fetch(`${origin}/api/rooms/${room.id}/join`, memberOptions("POST")),
    ]);
    assert.deepEqual(concurrentJoins.map((response) => response.status).sort(), [201, 409]);
    const joined = concurrentJoins.find((response) => response.status === 201);
    assert.equal((await joined.json()).joined, true);

    const participants = await fetch(`${origin}/api/rooms/${room.id}/participants`);
    assert.equal((await participants.json()).participants.length, 2);
    const participantsFirstPage = await fetch(
      `${origin}/api/rooms/${room.id}/participants?limit=1&offset=0`,
    );
    const participantsFirstBody = await participantsFirstPage.json();
    assert.equal(participantsFirstBody.pagination.hasMore, true);
    const participantsSecondPage = await fetch(
      `${origin}/api/rooms/${room.id}/participants?limit=1&offset=${participantsFirstBody.pagination.nextOffset}`,
    );
    const participantsSecondBody = await participantsSecondPage.json();
    assert.equal(participantsSecondBody.pagination.hasMore, false);
    assert.notEqual(
      participantsFirstBody.participants[0].participationId,
      participantsSecondBody.participants[0].participationId,
    );

    const presence = await fetch(
      `${origin}/api/rooms/${room.id}/presence`,
      memberOptions("POST"),
    );
    assert.equal(presence.status, 200);

    executeLocalSql(
      workspace.persist,
      `UPDATE room_participations
       SET last_seen_at = '2000-01-01T00:00:00.000Z'
       WHERE room_id = '${room.id}' AND user_id = 'test-member' AND left_at IS NULL`,
    );
    const presenceAfterStaleHeartbeat = await fetch(
      `${origin}/api/rooms/${room.id}/participants`,
    );
    const stalePresence = (await presenceAfterStaleHeartbeat.json()).participants;
    const stalePresenceByUser = new Map(
      stalePresence.map((participant) => [participant.user.id, participant.presence]),
    );
    assert.equal(stalePresenceByUser.get("test-owner"), "online");
    assert.equal(stalePresenceByUser.get("test-member"), "offline");

    const restoredPresence = await fetch(
      `${origin}/api/rooms/${room.id}/presence`,
      memberOptions("POST"),
    );
    assert.equal(restoredPresence.status, 200);
    const presenceAfterNewHeartbeat = await fetch(
      `${origin}/api/rooms/${room.id}/participants`,
    );
    const refreshedPresenceByUser = new Map(
      (await presenceAfterNewHeartbeat.json()).participants
        .map((participant) => [participant.user.id, participant.presence]),
    );
    assert.equal(refreshedPresenceByUser.get("test-member"), "online");

    const recommendationsUrl = `${origin}/api/rooms/${room.id}/recommendations`;
    const missingFields = await fetch(
      recommendationsUrl,
      ownerOptions("POST", { genre: "Pop" }),
    );
    assert.equal(missingFields.status, 400);

    const unsupportedProvider = await fetch(
      recommendationsUrl,
      ownerOptions("POST", {
        title: "Faixa inválida",
        artist: "Artista",
        genre: "Pop",
        url: "https://attacker.example/track/123",
      }),
    );
    assert.equal(unsupportedProvider.status, 400);
    assert.equal((await unsupportedProvider.json()).error.code, "UNSUPPORTED_MUSIC_PROVIDER");

    const forgedMetadata = await fetch(
      recommendationsUrl,
      ownerOptions("POST", {
        title: "Faixa falsa",
        artist: "Artista falso",
        genre: "Pop",
        coverImageUrl: "https://attacker.example/image.png",
        externalUrl: "https://attacker.example/track",
      }),
    );
    assert.equal(forgedMetadata.status, 400);

    const manual = await fetch(
      recommendationsUrl,
      ownerOptions("POST", {
        title: "Faixa manual",
        artist: "Artista manual",
        genre: "MPB",
        url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      }),
    );
    assert.equal(manual.status, 201);
    const recommendation = (await manual.json()).recommendation;
    assert.equal(recommendation.provider, "spotify");
    assert.equal(recommendation.externalUrl, "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    assert.equal(recommendation.title, "Faixa manual");

    const youtubeRecommendation = await fetch(
      recommendationsUrl,
      ownerOptions("POST", {
        title: "Vídeo para estudar",
        artist: "Canal de estudo",
        genre: "Outros",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    );
    assert.equal(youtubeRecommendation.status, 201);
    assert.equal((await youtubeRecommendation.json()).recommendation.provider, "youtube");

    const soundcloudRecommendation = await fetch(
      recommendationsUrl,
      ownerOptions("POST", {
        title: "Faixa independente",
        artist: "Artista independente",
        genre: "Eletrônica",
        url: "https://soundcloud.com/artist/track-name",
      }),
    );
    assert.equal(soundcloudRecommendation.status, 201);
    assert.equal((await soundcloudRecommendation.json()).recommendation.provider, "soundcloud");

    const allRecommendations = await fetch(recommendationsUrl);
    const allRecommendationsBody = await allRecommendations.json();
    assert.equal(
      allRecommendations.status,
      200,
      `${JSON.stringify(allRecommendationsBody)}\n${server.output()}`,
    );
    const allRecommendationIds = allRecommendationsBody.recommendations.map((item) => item.id);
    const recommendationsFirstPage = await fetch(`${recommendationsUrl}?limit=2&offset=0`);
    const recommendationsFirstBody = await recommendationsFirstPage.json();
    assert.equal(recommendationsFirstBody.pagination.hasMore, true);
    const recommendationsSecondPage = await fetch(
      `${recommendationsUrl}?limit=2&offset=${recommendationsFirstBody.pagination.nextOffset}&rankingVersion=${encodeURIComponent(recommendationsFirstBody.pagination.rankingVersion)}`,
    );
    const recommendationsSecondBody = await recommendationsSecondPage.json();
    assert.equal(recommendationsSecondBody.pagination.hasMore, false);
    assert.deepEqual(
      [
        ...recommendationsFirstBody.recommendations,
        ...recommendationsSecondBody.recommendations,
      ].map((item) => item.id),
      allRecommendationIds,
    );

    const voteUrl = `${origin}/api/recommendations/${recommendation.id}/vote`;
    const staleRankingVersion = recommendationsFirstBody.pagination.rankingVersion;
    assert.equal(typeof staleRankingVersion, "string");
    const rankingChangeVote = await fetch(voteUrl, ownerOptions("POST", { value: 1 }));
    assert.equal(rankingChangeVote.status, 200);
    const staleRankingPage = await fetch(
      `${recommendationsUrl}?limit=2&offset=2&rankingVersion=${encodeURIComponent(staleRankingVersion)}`,
    );
    assert.equal(staleRankingPage.status, 409);
    assert.equal((await staleRankingPage.json()).error.code, "RANKING_CHANGED");
    const refreshedRankingFirstPage = await fetch(`${recommendationsUrl}?limit=2&offset=0`);
    const refreshedRankingBody = await refreshedRankingFirstPage.json();
    assert.notEqual(refreshedRankingBody.pagination.rankingVersion, staleRankingVersion);
    const currentRankingPage = await fetch(
      `${recommendationsUrl}?limit=2&offset=${refreshedRankingBody.pagination.nextOffset}&rankingVersion=${encodeURIComponent(refreshedRankingBody.pagination.rankingVersion)}`,
    );
    assert.equal(currentRankingPage.status, 200);
    const missingRankingVersionPage = await fetch(`${recommendationsUrl}?limit=2&offset=2`);
    assert.equal(missingRankingVersionPage.status, 400);
    assert.equal(
      (await missingRankingVersionPage.json()).error.code,
      "RANKING_VERSION_REQUIRED",
    );

    const selfVote = await fetch(voteUrl, ownerOptions("POST", { value: 1 }));
    assert.equal(selfVote.status, 200);
    assert.equal((await selfVote.json()).score, 1);
    const removeSelfVote = await fetch(voteUrl, ownerOptions("DELETE"));
    assert.equal(removeSelfVote.status, 200);
    assert.equal((await removeSelfVote.json()).score, 0);

    const concurrentPositiveVotes = await Promise.all([
      fetch(voteUrl, memberOptions("POST", { value: 1 })),
      fetch(voteUrl, memberOptions("POST", { value: 1 })),
    ]);
    assert.deepEqual(concurrentPositiveVotes.map((response) => response.status), [200, 200]);
    const positiveResults = await Promise.all(concurrentPositiveVotes.map((response) => response.json()));
    assert.deepEqual(positiveResults.map((result) => result.score), [1, 1]);
    const negative = await fetch(voteUrl, memberOptions("POST", { value: -1 }));
    assert.equal((await negative.json()).score, -1);
    const removed = await fetch(voteUrl, memberOptions("DELETE"));
    assert.equal((await removed.json()).score, 0);

    const recommendationList = await fetch(recommendationsUrl);
    assert.equal((await recommendationList.json()).recommendations[0].score, 0);

    const leave = await fetch(
      `${origin}/api/rooms/${room.id}/leave`,
      memberOptions("POST"),
    );
    assert.equal((await leave.json()).left, true);
    const voteAfterLeave = await fetch(voteUrl, memberOptions("POST", { value: 1 }));
    assert.equal(voteAfterLeave.status, 403);
    const rejoin = await fetch(
      `${origin}/api/rooms/${room.id}/join`,
      memberOptions("POST"),
    );
    assert.equal(rejoin.status, 201);

    const memberRecommendationResponse = await fetch(
      recommendationsUrl,
      memberOptions("POST", {
        title: "Recomendação do participante",
        artist: "Artista participante",
        genre: "Rock",
        url: "https://youtu.be/dQw4w9WgXcQ",
      }),
    );
    assert.equal(memberRecommendationResponse.status, 201);
    const memberRecommendation = (await memberRecommendationResponse.json()).recommendation;
    const memberRecommendationVote = await fetch(
      `${origin}/api/recommendations/${memberRecommendation.id}/vote`,
      ownerOptions("POST", { value: -1 }),
    );
    assert.equal((await memberRecommendationVote.json()).score, -1);

    const protectedRecommendationUrl = `${origin}/api/recommendations/${recommendation.id}`;
    const unauthorizedRecommendationRemoval = await fetch(
      protectedRecommendationUrl,
      memberOptions("DELETE"),
    );
    assert.equal(unauthorizedRecommendationRemoval.status, 403);

    const unauthenticatedRecommendationRemoval = await fetch(
      protectedRecommendationUrl,
      jsonRequest(origin, "DELETE", null),
    );
    assert.equal(unauthenticatedRecommendationRemoval.status, 401);

    const missingRecommendation = await fetch(
      `${origin}/api/recommendations/nonexistent-recommendation`,
      ownerOptions("DELETE"),
    );
    assert.equal(missingRecommendation.status, 404);
    assert.equal((await missingRecommendation.json()).error.code, "RECOMMENDATION_NOT_FOUND");

    const preservedVote = await fetch(voteUrl, memberOptions("POST", { value: 1 }));
    assert.equal((await preservedVote.json()).score, 1);
    const removeOwnRecommendation = await fetch(
      protectedRecommendationUrl,
      ownerOptions("DELETE"),
    );
    assert.equal(removeOwnRecommendation.status, 200);
    assert.equal((await removeOwnRecommendation.json()).removed, true);

    const removeAlreadyRemoved = await fetch(
      protectedRecommendationUrl,
      ownerOptions("DELETE"),
    );
    assert.equal(removeAlreadyRemoved.status, 409);
    assert.equal((await removeAlreadyRemoved.json()).error.code, "RECOMMENDATION_REMOVED");

    const ownerLeaveBeforeCreatorDelete = await fetch(
      `${origin}/api/rooms/${room.id}/leave`,
      ownerOptions("POST"),
    );
    assert.equal(ownerLeaveBeforeCreatorDelete.status, 200);
    const creatorRemovesMemberRecommendation = await fetch(
      `${origin}/api/recommendations/${memberRecommendation.id}`,
      ownerOptions("DELETE"),
    );
    assert.equal(creatorRemovesMemberRecommendation.status, 200);
    const ownerRejoinAfterDelete = await fetch(
      `${origin}/api/rooms/${room.id}/join`,
      ownerOptions("POST"),
    );
    assert.equal(ownerRejoinAfterDelete.status, 201);

    const endedRecommendationResponse = await fetch(
      recommendationsUrl,
      memberOptions("POST", {
        title: "Recomendação antes do encerramento",
        artist: "Artista participante",
        genre: "Jazz",
        url: "https://youtu.be/9bZkp7q19f0",
      }),
    );
    assert.equal(endedRecommendationResponse.status, 201);
    const endedRecommendation = (await endedRecommendationResponse.json()).recommendation;

    const departedAuthorRecommendationResponse = await fetch(
      recommendationsUrl,
      memberOptions("POST", {
        title: "Recomendação antes da saída",
        artist: "Artista participante",
        genre: "Jazz",
        url: "https://youtu.be/aqz-KE-bpKQ",
      }),
    );
    assert.equal(departedAuthorRecommendationResponse.status, 201);
    const departedAuthorRecommendation =
      (await departedAuthorRecommendationResponse.json()).recommendation;
    const memberLeaveBeforeOwnDelete = await fetch(
      `${origin}/api/rooms/${room.id}/leave`,
      memberOptions("POST"),
    );
    assert.equal(memberLeaveBeforeOwnDelete.status, 200);
    const authorRemovesAfterLeaving = await fetch(
      `${origin}/api/recommendations/${departedAuthorRecommendation.id}`,
      memberOptions("DELETE"),
    );
    assert.equal(authorRemovesAfterLeaving.status, 200);
    const memberRejoinAfterOwnDelete = await fetch(
      `${origin}/api/rooms/${room.id}/join`,
      memberOptions("POST"),
    );
    assert.equal(memberRejoinAfterOwnDelete.status, 201);

    const activeRecommendations = await fetch(recommendationsUrl);
    const activeRecommendationIds = (await activeRecommendations.json())
      .recommendations.map((item) => item.id);
    assert.equal(activeRecommendationIds.includes(recommendation.id), false);
    assert.equal(activeRecommendationIds.includes(memberRecommendation.id), false);
    assert.equal(activeRecommendationIds.includes(departedAuthorRecommendation.id), false);
    assert.equal(activeRecommendationIds.includes(endedRecommendation.id), true);

    const cachedSearchUrl = `${origin}/api/music/search?q=cache-check&limit=10&offset=0`;
    for (let request = 0; request < 12; request += 1) {
      const cachedSearch = await fetch(cachedSearchUrl, {
        headers: { Cookie: `soundroom_session=${tokenMember}` },
      });
      assert.equal(cachedSearch.status, 200);
      assert.equal((await cachedSearch.json()).cached, true);
    }
    const rateLimited = await fetch(cachedSearchUrl, {
      headers: { Cookie: `soundroom_session=${tokenMember}` },
    });
    assert.equal(rateLimited.status, 429);
    assert.equal(rateLimited.headers.get("Retry-After") !== null, true);

    const unauthorizedClose = await fetch(
      `${origin}/api/rooms/${room.id}/close`,
      memberOptions("POST"),
    );
    assert.equal(unauthorizedClose.status, 403);

    const closed = await fetch(
      `${origin}/api/rooms/${room.id}/close`,
      ownerOptions("POST"),
    );
    assert.equal(closed.status, 200);
    assert.equal((await closed.json()).closed, true);

    const endedRoom = await fetch(`${origin}/api/rooms/${room.id}`);
    assert.equal((await endedRoom.json()).room.status, "ended");
    const endedRecommendations = await fetch(recommendationsUrl);
    assert.equal(endedRecommendations.status, 409);

    const removeAfterClose = await fetch(
      `${origin}/api/recommendations/${endedRecommendation.id}`,
      memberOptions("DELETE"),
    );
    assert.equal(removeAfterClose.status, 409);
    assert.equal((await removeAfterClose.json()).error.code, "ROOM_ENDED");

    const history = await fetch(`${origin}/api/rooms/${room.id}/history`);
    const historyBody = await history.json();
    assert.equal(historyBody.recommendations.length, 6);
    const historyById = new Map(
      historyBody.recommendations.map((item) => [item.id, item]),
    );
    assert.equal(historyById.get(recommendation.id).status, "removed");
    assert.equal(historyById.get(recommendation.id).score, 1);
    assert.equal(historyById.get(memberRecommendation.id).status, "removed");
    assert.equal(historyById.get(memberRecommendation.id).score, -1);
    assert.equal(historyById.get(departedAuthorRecommendation.id).status, "removed");
    assert.equal(historyById.get(endedRecommendation.id).status, "active");
    assert.ok(historyBody.counts.participations >= 3);

    const historyFirstPage = await fetch(
      `${origin}/api/rooms/${room.id}/history?limit=2&offset=0`,
    );
    const historyFirstBody = await historyFirstPage.json();
    assert.equal(historyFirstBody.pagination.recommendations.hasMore, true);
    assert.equal(historyFirstBody.pagination.participations.hasMore, true);
    const historySecondPage = await fetch(
      `${origin}/api/rooms/${room.id}/history?limit=2&offset=2`,
    );
    const historySecondBody = await historySecondPage.json();
    const historyFinalPage = await fetch(
      `${origin}/api/rooms/${room.id}/history?limit=2&offset=4`,
    );
    const historyFinalBody = await historyFinalPage.json();
    assert.equal(historyFinalBody.pagination.recommendations.hasMore, false);
    assert.equal(historyFinalBody.pagination.participations.hasMore, false);
    assert.deepEqual(
      [
        ...historyFirstBody.recommendations,
        ...historySecondBody.recommendations,
        ...historyFinalBody.recommendations,
      ].map((item) => item.id),
      historyBody.recommendations.map((item) => item.id),
    );
    assert.deepEqual(
      [
        ...historyFirstBody.participations,
        ...historySecondBody.participations,
        ...historyFinalBody.participations,
      ].map((item) => item.participationId),
      historyBody.participations.map((item) => item.participationId),
    );

    const logout = await fetch(
      `${origin}/api/auth/logout`,
      ownerOptions("POST"),
    );
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("Set-Cookie"), /Max-Age=0/u);
    const afterLogout = await fetch(`${origin}/api/auth/me`, {
      headers: { Cookie: `soundroom_session=${tokenOwner}` },
    });
    assert.deepEqual(await afterLogout.json(), { user: null });
  } finally {
    if (server) await server.stop();
    await workspace.cleanup();
  }
});
