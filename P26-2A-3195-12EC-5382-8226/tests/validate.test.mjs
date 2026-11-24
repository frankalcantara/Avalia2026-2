// Testes unitários das regras de negócio validadas no servidor.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateHabitName,
  validateColor,
  validateHabitId,
  validateCompletionDate,
  validateMonth,
} from "../src/lib/validate.js";
import { avatarUrl, profileFromDiscord } from "../src/lib/discord.js";

const TODAY = "2026-11-18";

test("nome do hábito: normaliza espaços e rejeita vazio/longo/não-string", () => {
  assert.deepEqual(validateHabitName("  Ler   20  páginas "), { ok: true, value: "Ler 20 páginas" });
  assert.equal(validateHabitName("   ").ok, false);
  assert.equal(validateHabitName("x".repeat(61)).ok, false);
  assert.equal(validateHabitName(123).ok, false);
  assert.equal(validateHabitName("a\u0000b").value, "ab");
  // acentos decompostos (NFD) e caracteres invisíveis não criam nomes "diferentes"
  assert.equal(validateHabitName("a\u0301gua").value, "\u00e1gua");
  assert.equal(validateHabitName("\u00e1\u200bgua").value, "\u00e1gua");
  assert.equal(validateHabitName("\ufeff\u202eLer").value, "Ler");
  assert.equal(validateHabitName("\u200b\u200b").ok, false);
});

test("cor: padrão azul e lista fechada", () => {
  assert.deepEqual(validateColor(undefined), { ok: true, value: "azul" });
  assert.equal(validateColor("verde").ok, true);
  assert.equal(validateColor("#ff0000").ok, false);
  assert.equal(validateColor("red; background:url(x)").ok, false);
});

test("ID do hábito: só inteiros positivos", () => {
  assert.deepEqual(validateHabitId("42"), { ok: true, value: 42 });
  for (const bad of ["0", "-1", "1.5", "abc", "1 OR 1=1", ""]) assert.equal(validateHabitId(bad).ok, false, bad);
});

test("data de conclusão: não aceita futuro, formato errado nem muito antiga", () => {
  assert.equal(validateCompletionDate("2026-11-18", TODAY).ok, true);
  assert.equal(validateCompletionDate("2026-11-01", TODAY).ok, true);
  assert.equal(validateCompletionDate("2026-11-19", TODAY).ok, false);
  assert.equal(validateCompletionDate("18/11/2026", TODAY).ok, false);
  assert.equal(validateCompletionDate("2026-02-30", TODAY).ok, false);
  assert.equal(validateCompletionDate("2024-01-01", TODAY).ok, false);
});

test("mês: padrão é o mês de hoje; futuro e formato inválido são rejeitados", () => {
  assert.deepEqual(validateMonth(null, TODAY), { ok: true, value: "2026-11" });
  assert.equal(validateMonth("2026-10", TODAY).ok, true);
  assert.equal(validateMonth("2026-12", TODAY).ok, false);
  assert.equal(validateMonth("2026-1", TODAY).ok, false);
});

test("Discord: avatar personalizado, animado e padrão", () => {
  assert.equal(
    avatarUrl("80351110224678912", "8342729096ea3675442027381ff50dfe"),
    "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png?size=128"
  );
  assert.match(avatarUrl("80351110224678912", "a_8342729096ea3675442027381ff50dfe"), /\.gif\?size=128$/);
  assert.match(avatarUrl("80351110224678912", null), /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
});

test("Discord: perfil importado (user_id, nome e avatar) e rejeição de resposta inválida", () => {
  const p = profileFromDiscord({ id: "80351110224678912", username: "nelly", global_name: "Nelly", avatar: null });
  assert.equal(p.user_id, "80351110224678912");
  assert.equal(p.username, "nelly");
  assert.equal(p.display_name, "Nelly");
  assert.ok(p.avatar_url.startsWith("https://cdn.discordapp.com/"));
  assert.equal(profileFromDiscord({ id: "abc", username: "x" }), null);
  assert.equal(profileFromDiscord(null), null);
});
