// Regras do jogo diário (clássico e sombra) executadas no servidor
import { MODES, WORD_LENGTH } from "./config.js";
import { addDays, today } from "./dates.js";
import { displayOf, isValidWord } from "./dictionary.js";
import { computeFeedback, isWinningFeedback } from "./feedback.js";
import { HttpError } from "./http.js";
import { normalizeWord } from "./normalize.js";
import { getDailyWord } from "./words.js";

export function modeConfig(mode) {
  const cfg = Object.hasOwn(MODES, mode) ? MODES[mode] : null;
  if (!cfg) throw new HttpError(400, "invalid_mode", "Modo de jogo inválido.");
  return cfg;
}

export function parseGuess(raw) {
  const key = normalizeWord(raw);
  if (!key) throw new HttpError(400, "invalid_format", `O chute precisa ter exatamente ${WORD_LENGTH} letras.`);
  if (!isValidWord(key)) throw new HttpError(422, "not_a_word", "Essa palavra não está no dicionário do Cypher.");
  return key;
}

const parseAttempts = (rows) => rows.map((g) => ({ guess: g.guess, feedback: JSON.parse(g.feedback) }));

async function loadGame(env, userId, mode, date) {
  const game = await env.DB.prepare("SELECT * FROM games WHERE user_id = ? AND mode = ? AND day = ?")
    .bind(userId, mode, date).first();
  if (!game) return { game: null, attempts: [] };
  const { results } = await env.DB.prepare(
    "SELECT guess, feedback FROM guesses WHERE game_id = ? ORDER BY attempt_no"
  ).bind(game.id).all();
  return { game, attempts: parseAttempts(results) };
}

function buildState(mode, date, game, attempts, answerKey) {
  const t = today();
  const status = game ? game.status : "playing";
  return {
    mode,
    date,
    today: t,
    isToday: date === t,
    isArchive: game ? Boolean(game.is_archive) : date < t,
    maxAttempts: MODES[mode].maxAttempts,
    wordLength: WORD_LENGTH,
    status,
    attempts,
    answer: status !== "playing" && answerKey ? displayOf(answerKey) : null,
  };
}

export async function getGameState(env, user, mode, date) {
  modeConfig(mode);
  const { game, attempts } = await loadGame(env, user.id, mode, date);
  const finished = game && game.status !== "playing";
  const answerKey = finished ? await getDailyWord(env, mode, date) : null;
  return buildState(mode, date, game, attempts, answerKey);
}

// Monta o UPSERT das estatísticas consolidadas ao fim de uma partida
async function statsStatement(env, userId, mode, game, won, attemptNo) {
  const cfg = MODES[mode];
  const row = (await env.DB.prepare("SELECT * FROM user_stats WHERE user_id = ? AND mode = ?").bind(userId, mode).first()) || {
    played: 0, wins: 0, current_streak: 0, max_streak: 0, last_win_day: null,
    distribution: "[]", win_attempts_total: 0, archive_played: 0, archive_wins: 0,
  };
  const s = { ...row };
  let dist = JSON.parse(row.distribution || "[]");
  if (!Array.isArray(dist) || dist.length !== cfg.maxAttempts) dist = new Array(cfg.maxAttempts).fill(0);

  if (game.is_archive) {
    s.archive_played += 1;
    if (won) s.archive_wins += 1;
  } else {
    s.played += 1;
    if (won) {
      s.wins += 1;
      dist[attemptNo - 1] += 1;
      s.win_attempts_total += attemptNo;
      s.current_streak = row.last_win_day === addDays(game.day, -1) ? row.current_streak + 1 : 1;
      s.max_streak = Math.max(row.max_streak, s.current_streak);
      s.last_win_day = game.day;
    } else {
      s.current_streak = 0;
    }
  }

  return env.DB.prepare(
    `INSERT INTO user_stats (user_id, mode, played, wins, current_streak, max_streak, last_win_day, distribution,
                             win_attempts_total, archive_played, archive_wins)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, mode) DO UPDATE SET
       played = excluded.played, wins = excluded.wins, current_streak = excluded.current_streak,
       max_streak = excluded.max_streak, last_win_day = excluded.last_win_day, distribution = excluded.distribution,
       win_attempts_total = excluded.win_attempts_total, archive_played = excluded.archive_played,
       archive_wins = excluded.archive_wins`
  ).bind(userId, mode, s.played, s.wins, s.current_streak, s.max_streak, s.last_win_day, JSON.stringify(dist),
    s.win_attempts_total, s.archive_played, s.archive_wins);
}

export async function submitGuess(env, user, mode, date, rawGuess) {
  const cfg = modeConfig(mode);
  const key = parseGuess(rawGuess);

  let { game, attempts } = await loadGame(env, user.id, mode, date);
  if (game && game.status !== "playing") throw new HttpError(409, "game_over", "Esse cofre já foi encerrado.");

  const answerKey = await getDailyWord(env, mode, date);
  if (!game) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO games (user_id, mode, day, status, attempts, is_archive) VALUES (?, ?, ?, 'playing', 0, ?)"
    ).bind(user.id, mode, date, date < today() ? 1 : 0).run();
    ({ game, attempts } = await loadGame(env, user.id, mode, date));
  }

  const attemptNo = game.attempts + 1;
  if (attemptNo > cfg.maxAttempts) throw new HttpError(409, "game_over", "Você já usou todas as tentativas.");

  const feedback = computeFeedback(cfg.kind, answerKey, key);
  const won = isWinningFeedback(cfg.kind, feedback, WORD_LENGTH);
  const status = won ? "won" : attemptNo >= cfg.maxAttempts ? "lost" : "playing";

  const statements = [
    env.DB.prepare("INSERT INTO guesses (game_id, attempt_no, guess, feedback) VALUES (?, ?, ?, ?)")
      .bind(game.id, attemptNo, key, JSON.stringify(feedback)),
    env.DB.prepare(
      `UPDATE games SET attempts = ?, status = ?, finished_at = CASE WHEN ? <> 'playing' THEN datetime('now') END
        WHERE id = ? AND attempts = ?`
    ).bind(attemptNo, status, status, game.id, game.attempts),
  ];
  if (status !== "playing") statements.push(await statsStatement(env, user.id, mode, game, won, attemptNo));

  try {
    await env.DB.batch(statements);
  } catch (err) {
    if (/UNIQUE|PRIMARY KEY|constraint/i.test(String(err && err.message))) {
      throw new HttpError(409, "conflict", "Outra tentativa foi enviada ao mesmo tempo. Recarregue o cofre.");
    }
    throw err;
  }

  game = { ...game, status, attempts: attemptNo };
  return buildState(mode, date, game, [...attempts, { guess: key, feedback }], answerKey);
}
