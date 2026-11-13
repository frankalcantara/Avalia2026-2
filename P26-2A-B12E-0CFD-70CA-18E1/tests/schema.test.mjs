/**
 * Testes do schema D1 (migrations/0001_init.sql).
 *
 * Usa `node:sqlite` (Node >= 22) para aplicar a migration em memória e provar
 * que as regras críticas estão no banco, não só no JavaScript:
 *   - CHECKs de modo/tamanho de grupo/status/origem
 *   - UNIQUE(room_id, user_id) permite vários manuais (NULL) e bloqueia
 *     entrada duplicada de um mesmo usuário do Discord
 *   - triggers de imutabilidade em draws e draw_entries
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIGRATION = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");

const AGORA = "2026-11-08T12:00:00.000Z";

function banco() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(MIGRATION);
  db.exec(`
    INSERT INTO discord_users (user_id, username, created_at, updated_at)
    VALUES ('dono', 'dono', '${AGORA}', '${AGORA}'),
           ('aluno1', 'aluno1', '${AGORA}', '${AGORA}'),
           ('aluno2', 'aluno2', '${AGORA}', '${AGORA}');
  `);
  return db;
}

function criarSala(db, overrides = {}) {
  const sala = {
    id: "sala-1",
    public_code: "ABCD2345",
    owner_user_id: "dono",
    title: "Seminário de LP",
    mode: "groups",
    group_size: 3,
    ...overrides,
  };
  db.prepare(
    `INSERT INTO rooms (id, public_code, owner_user_id, title, mode, group_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sala.id, sala.public_code, sala.owner_user_id, sala.title, sala.mode, sala.group_size, AGORA, AGORA);
  return sala;
}

function criarAta(db, { id = "draw-1", seq = 1, codigo = "SORT-ABCD-2345" } = {}) {
  db.prepare(
    `INSERT INTO draws (
       id, room_id, seq, mode, params_json, participants_json, result_json, swaps_json,
       audit_hash, verification_code, created_by_user_id, created_at
     ) VALUES (?, 'sala-1', ?, 'order', '{}', '[]', '{}', '[]', ?, ?, 'dono', ?)`
  ).run(id, seq, "a".repeat(64), codigo, AGORA);
}

test("migration cria todas as tabelas e índices esperados", () => {
  const db = banco();
  const tabelas = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((linha) => linha.name);
  assert.deepEqual(tabelas, ["discord_users", "draw_entries", "draws", "participants", "rooms", "sessions"]);

  const indices = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
    .all()
    .map((linha) => linha.name);
  for (const esperado of [
    "idx_sessions_user",
    "idx_sessions_expires",
    "idx_rooms_owner",
    "idx_rooms_status",
    "idx_participants_room",
    "idx_participants_user",
    "idx_draws_room",
    "idx_draws_created",
    "idx_draw_entries_user",
  ]) {
    assert.ok(indices.includes(esperado), `índice ausente: ${esperado}`);
  }

  const triggers = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
    .all()
    .map((linha) => linha.name)
    .sort();
  assert.deepEqual(triggers, [
    "trg_draw_entries_no_delete",
    "trg_draw_entries_no_update",
    "trg_draws_no_delete",
    "trg_draws_no_update",
  ]);
  db.close();
});

test("rooms aplica CHECKs de modo, group_size, status e título", () => {
  const db = banco();
  criarSala(db);

  assert.throws(() => criarSala(db, { id: "s2", public_code: "ABCD2346", mode: "x" }), /CHECK/);
  assert.throws(
    () => criarSala(db, { id: "s3", public_code: "ABCD2347", mode: "groups", group_size: 1 }),
    /CHECK/
  );
  assert.throws(
    () => criarSala(db, { id: "s4", public_code: "ABCD2348", mode: "groups", group_size: 51 }),
    /CHECK/
  );
  // mode = 'order' exige group_size NULL
  assert.throws(
    () => criarSala(db, { id: "s5", public_code: "ABCD2349", mode: "order", group_size: 4 }),
    /CHECK/
  );
  // mode = 'groups' exige group_size preenchido
  assert.throws(
    () => criarSala(db, { id: "s6", public_code: "ABCD2350", mode: "groups", group_size: null }),
    /CHECK/
  );
  assert.throws(() => criarSala(db, { id: "s7", public_code: "ABCD2351", title: "ab" }), /CHECK/);

  // order com group_size NULL é válido
  criarSala(db, { id: "s8", public_code: "ABCD2352", mode: "order", group_size: null });
  // group_size no limite superior é válido
  criarSala(db, { id: "s9", public_code: "ABCD2353", mode: "groups", group_size: 50 });

  assert.throws(
    () => db.prepare("UPDATE rooms SET status = 'x' WHERE id = 'sala-1'").run(),
    /CHECK/
  );
  db.close();
});

test("participants: UNIQUE(room_id, user_id) convive com vários NULL manuais", () => {
  const db = banco();
  criarSala(db);

  const inserir = (nome, userId, source, addedBy = "dono") =>
    db
      .prepare(
        `INSERT INTO participants (room_id, user_id, display_name, source, added_by_user_id, joined_at)
         VALUES ('sala-1', ?, ?, ?, ?, ?)`
      )
      .run(userId, nome, source, addedBy, AGORA);

  // Vários manuais (user_id NULL) no mesmo sala: permitido pelo SQLite.
  inserir("Ana", null, "manual");
  inserir("Bruno", null, "manual");
  inserir("Carla", null, "manual");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM participants").get().n, 3);

  // Mesmo usuário do Discord duas vezes na mesma sala: bloqueado.
  inserir("Diego", "aluno1", "discord");
  assert.throws(() => inserir("Diego de novo", "aluno1", "discord"), /UNIQUE/);

  // O mesmo usuário em outra sala é permitido.
  criarSala(db, { id: "sala-2", public_code: "ABCD2354" });
  db.prepare(
    `INSERT INTO participants (room_id, user_id, display_name, source, added_by_user_id, joined_at)
     VALUES ('sala-2', 'aluno1', 'Diego', 'discord', 'dono', ?)`
  ).run(AGORA);
  db.close();
});

test("participants: CHECK exige source coerente com user_id", () => {
  const db = banco();
  criarSala(db);

  const inserir = (userId, source) =>
    db
      .prepare(
        `INSERT INTO participants (room_id, user_id, display_name, source, added_by_user_id, joined_at)
         VALUES ('sala-1', ?, 'Fulano', ?, 'dono', ?)`
      )
      .run(userId, source, AGORA);

  assert.throws(() => inserir(null, "discord"), /CHECK/);
  assert.throws(() => inserir("aluno1", "manual"), /CHECK/);
  assert.throws(() => inserir("aluno1", "outro"), /CHECK/);
  db.close();
});

test("draws: ata imutável — UPDATE e DELETE abortam", () => {
  const db = banco();
  criarSala(db);
  criarAta(db);

  assert.throws(
    () => db.prepare("UPDATE draws SET result_json = '{}' WHERE id = 'draw-1'").run(),
    /ata imutavel/
  );
  assert.throws(
    () => db.prepare("UPDATE draws SET audit_hash = ? WHERE id = 'draw-1'").run("b".repeat(64)),
    /ata imutavel/
  );
  assert.throws(() => db.prepare("DELETE FROM draws WHERE id = 'draw-1'").run(), /ata imutavel/);

  const linha = db.prepare("SELECT audit_hash FROM draws WHERE id = 'draw-1'").get();
  assert.equal(linha.audit_hash, "a".repeat(64));
  db.close();
});

test("draw_entries: imutável e exige posição única por ata", () => {
  const db = banco();
  criarSala(db);
  criarAta(db);

  const inserir = (posicao, nome) =>
    db
      .prepare("INSERT INTO draw_entries (draw_id, position, display_name) VALUES ('draw-1', ?, ?)")
      .run(posicao, nome);

  inserir(1, "Ana");
  inserir(2, "Bruno");
  assert.throws(() => inserir(1, "Duplicado"), /PRIMARY KEY|UNIQUE/);

  assert.throws(
    () => db.prepare("UPDATE draw_entries SET display_name = 'x' WHERE position = 1").run(),
    /ata imutavel/
  );
  assert.throws(() => db.prepare("DELETE FROM draw_entries WHERE position = 1").run(), /ata imutavel/);
  db.close();
});

test("draws: seq por sala é único, código de verificação é global", () => {
  const db = banco();
  criarSala(db);

  criarAta(db, { id: "draw-1", seq: 1, codigo: "SORT-AAAA-1111" });
  // Mesma seq na mesma sala: bloqueado.
  assert.throws(() => criarAta(db, { id: "draw-2", seq: 1, codigo: "SORT-AAAA-2222" }), /UNIQUE/);
  // Mesmo código em outra sala/ata: bloqueado.
  assert.throws(() => criarAta(db, { id: "draw-3", seq: 2, codigo: "SORT-AAAA-1111" }), /UNIQUE/);
  // Seq seguinte e código novo: aceito.
  criarAta(db, { id: "draw-4", seq: 2, codigo: "SORT-AAAA-3333" });

  // Mesma seq em outra sala: aceito.
  criarSala(db, { id: "sala-2", public_code: "ABCD2355" });
  db.prepare(
    `INSERT INTO draws (
       id, room_id, seq, mode, params_json, participants_json, result_json, swaps_json,
       audit_hash, verification_code, created_by_user_id, created_at
     ) VALUES ('draw-5', 'sala-2', 1, 'order', '{}', '[]', '{}', '[]', ?, 'SORT-BBBB-4444', 'dono', ?)`
  ).run("c".repeat(64), AGORA);
  db.close();
});

test("rooms: exclusão em cascata dos participantes é bloqueada quando há ata", () => {
  const db = banco();
  criarSala(db);
  db.prepare(
    `INSERT INTO participants (room_id, user_id, display_name, source, added_by_user_id, joined_at)
     VALUES ('sala-1', NULL, 'Ana', 'manual', 'dono', ?)`
  ).run(AGORA);

  // Sala sem ata: DELETE remove os participantes junto (ON DELETE CASCADE).
  const db2 = banco();
  criarSala(db2);
  db2.prepare(
    `INSERT INTO participants (room_id, user_id, display_name, source, added_by_user_id, joined_at)
     VALUES ('sala-1', NULL, 'Ana', 'manual', 'dono', ?)`
  ).run(AGORA);
  db2.prepare("DELETE FROM rooms WHERE id = 'sala-1'").run();
  assert.equal(db2.prepare("SELECT COUNT(*) AS n FROM participants").get().n, 0);
  db2.close();

  // Sala com ata: a FK de draws (sem CASCADE) impede apagar a sala.
  criarAta(db);
  assert.throws(() => db.prepare("DELETE FROM rooms WHERE id = 'sala-1'").run(), /FOREIGN KEY/);
  db.close();
});

test("sessions: token_hash é PK e FK para discord_users", () => {
  const db = banco();

  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
     VALUES ('hash-1', 'dono', ?, ?)`
  ).run(AGORA, "2026-11-09T12:00:00.000Z");

  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
           VALUES ('hash-1', 'aluno1', ?, ?)`
        )
        .run(AGORA, "2026-11-09T12:00:00.000Z"),
    /PRIMARY KEY|UNIQUE/
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
           VALUES ('hash-2', 'inexistente', ?, ?)`
        )
        .run(AGORA, "2026-11-09T12:00:00.000Z"),
    /FOREIGN KEY/
  );
  db.close();
});
