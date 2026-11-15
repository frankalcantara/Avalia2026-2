import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  applyLocalMigrations,
  executeLocalSql,
  makeTempWorkspace,
  projectRoot,
  runWrangler,
} from "../helpers/local-pages.mjs";

function executeMigrationFile(persist, filename) {
  runWrangler([
    "d1",
    "execute",
    "soundroom",
    "--local",
    "--persist-to",
    persist,
    "--file",
    path.join(projectRoot, "migrations", "soundroom", filename),
  ]);
}

function localRows(persist, sql) {
  const output = JSON.parse(executeLocalSql(persist, sql));
  const batches = Array.isArray(output) ? output : [output];
  return batches.flatMap((batch) => batch.results ?? []);
}

test("all six versioned migrations apply to an isolated local D1 database", async () => {
  const workspace = await makeTempWorkspace("soundroom-migrations-");
  try {
    applyLocalMigrations(workspace.persist);
    const appliedMigrations = localRows(
      workspace.persist,
      "SELECT name FROM d1_migrations ORDER BY name",
    );
    assert.deepEqual(appliedMigrations.map((migration) => migration.name), [
      "0001_initial_schema.sql",
      "0002_music_rooms.sql",
      "0003_participant_presence.sql",
      "0004_spotify_catalog.sql",
      "0005_external_music_links.sql",
      "0006_allow_self_votes.sql",
    ]);

    const professorTemplateTables = localRows(
      workspace.persist,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('discord_users', 'project_records') ORDER BY name",
    );
    assert.deepEqual(professorTemplateTables, []);

    const tableOutput = executeLocalSql(
      workspace.persist,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'rooms', 'sessions', 'room_participations', 'music_recommendations', 'music_votes', 'music_recommendation_metadata', 'music_search_cache', 'music_search_rate_limits') ORDER BY name",
    );
    for (const name of [
      "users",
      "rooms",
      "sessions",
      "room_participations",
      "music_recommendations",
      "music_votes",
      "music_recommendation_metadata",
      "music_search_cache",
      "music_search_rate_limits",
    ]) {
      assert.match(tableOutput, new RegExp(`"${name}"`, "u"));
    }

    const musicColumns = executeLocalSql(
      workspace.persist,
      "PRAGMA table_info(music_recommendations)",
    );
    assert.match(musicColumns, /"name":\s*"provider"/u);
    assert.match(musicColumns, /"name":\s*"external_url"/u);

    const integrityOutput = executeLocalSql(
      workspace.persist,
      "PRAGMA foreign_key_check",
    );
    assert.doesNotMatch(integrityOutput, /"table"\s*:/u);
  } finally {
    await workspace.cleanup();
  }
});

test("migration 0005 copies legacy Spotify metadata without losing recommendations", async () => {
  const workspace = await makeTempWorkspace("soundroom-migration-0005-");
  try {
    for (const migration of [
      "0001_initial_schema.sql",
      "0002_music_rooms.sql",
      "0003_participant_presence.sql",
      "0004_spotify_catalog.sql",
    ]) {
      executeMigrationFile(workspace.persist, migration);
    }

    executeLocalSql(
      workspace.persist,
      `
        INSERT INTO users (id, discord_id, display_name)
        VALUES ('migration-owner', '12345678901234567', 'Pessoa Migration');
        INSERT INTO rooms (id, owner_id, name, category)
        VALUES ('migration-room', 'migration-owner', 'Sala Migration', 'Estudo');
        INSERT INTO room_participations (id, room_id, user_id, joined_at)
        VALUES (
          'migration-participation',
          'migration-room',
          'migration-owner',
          '2024-01-02T03:04:05.000Z'
        );
        INSERT INTO music_recommendations
          (id, room_id, author_id, title, artist, genre, created_at, updated_at)
        VALUES
          (
            'with-metadata',
            'migration-room',
            'migration-owner',
            'Faixa com metadados',
            'Artista um',
            'Pop',
            '2024-01-02T03:04:05.000Z',
            '2024-01-02T03:04:05.000Z'
          ),
          (
            'without-metadata',
            'migration-room',
            'migration-owner',
            'Faixa legada sem metadados',
            'Artista dois',
            'Rock',
            '2024-01-02T03:04:06.000Z',
            '2024-01-02T03:04:06.000Z'
          );
        INSERT INTO music_recommendation_metadata
          (
            recommendation_id,
            provider,
            provider_track_id,
            album,
            cover_image_url,
            external_url,
            duration_ms,
            created_at
          )
        VALUES (
          'with-metadata',
          'spotify',
          '0123456789ABCDEFGHIJKL',
          'Álbum legado',
          'https://i.scdn.co/image/legacy-cover',
          'https://open.spotify.com/track/0123456789ABCDEFGHIJKL',
          187000,
          '2024-01-02T03:04:05.000Z'
        );
      `,
    );

    executeMigrationFile(workspace.persist, "0005_external_music_links.sql");

    const recommendations = localRows(
      workspace.persist,
      "SELECT id, title, artist, provider, external_url FROM music_recommendations ORDER BY id",
    );
    assert.equal(recommendations.length, 2);
    const recommendationsById = new Map(recommendations.map((row) => [row.id, row]));
    assert.equal(recommendationsById.get("with-metadata").title, "Faixa com metadados");
    assert.equal(recommendationsById.get("with-metadata").provider, "spotify");
    assert.equal(
      recommendationsById.get("with-metadata").external_url,
      "https://open.spotify.com/track/0123456789ABCDEFGHIJKL",
    );
    assert.equal(recommendationsById.get("without-metadata").title, "Faixa legada sem metadados");
    assert.equal(recommendationsById.get("without-metadata").provider, null);
    assert.equal(recommendationsById.get("without-metadata").external_url, null);

    const metadata = localRows(
      workspace.persist,
      "SELECT recommendation_id, provider, provider_track_id, album FROM music_recommendation_metadata",
    );
    assert.deepEqual(metadata, [{
      recommendation_id: "with-metadata",
      provider: "spotify",
      provider_track_id: "0123456789ABCDEFGHIJKL",
      album: "Álbum legado",
    }]);
  } finally {
    await workspace.cleanup();
  }
});
