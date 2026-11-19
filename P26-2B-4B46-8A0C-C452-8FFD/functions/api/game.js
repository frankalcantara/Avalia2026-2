import { getUser } from "../lib/auth.js";
import { json, validOrigin } from "../lib/http.js";
import { dailyAnswer, gameClock, normalizeGuess, previousDate, scoreGuess } from "../lib/termo.js";

function statsFromHistory(history, date) {
  const distribution = [0, 0, 0, 0, 0, 0];
  let wins = 0;
  let best = 0;
  let run = 0;
  let lastWin = null;

  for (const entry of history) {
    if (!entry.won) continue;
    wins += 1;
    distribution[entry.used - 1] += 1;
    run = lastWin === previousDate(entry.date) ? run + 1 : 1;
    best = Math.max(best, run);
    lastWin = entry.date;
  }

  const current = history.at(-1);
  const lostToday = current?.date === date && current.used === 6 && !current.won;
  const streak = !lostToday && (lastWin === date || lastWin === previousDate(date)) ? run : 0;
  return { played: history.length, wins, streak, best, distribution };
}

async function readGame(db, user, clock) {
  const [attempts, history] = await db.batch([
    db.prepare(`
      SELECT guess, marks, is_win FROM attempts
      WHERE user_id = ? AND date = ? ORDER BY position
    `).bind(user.user_id, clock.date),
    db.prepare(`
      SELECT date, COUNT(*) AS used, MAX(is_win) AS won
      FROM attempts WHERE user_id = ? AND date <= ?
      GROUP BY date ORDER BY date
    `).bind(user.user_id, clock.date),
  ]);
  const status = attempts.results.some((attempt) => attempt.is_win)
    ? "won" : attempts.results.length === 6 ? "lost" : "playing";

  return json({
    user,
    ...clock,
    attempts: attempts.results.map(({ guess, marks }) => ({ guess, marks: JSON.parse(marks) })),
    status,
    stats: statsFromHistory(history.results, clock.date),
  });
}

function configured(env) {
  return Boolean(env.DB && env.SESSION_SECRET?.length >= 32 && env.DAILY_WORD_SECRET?.length >= 32);
}

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ error: "Jogo indisponível." }, 503);
  const user = await getUser(request, env);
  if (!user) return json({ error: "Entre com sua conta do Discord para jogar." }, 401);
  return readGame(env.DB, user, gameClock());
}

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ error: "Jogo indisponível." }, 503);
  const user = await getUser(request, env);
  if (!user) return json({ error: "Entre com sua conta do Discord para jogar." }, 401);
  if (!validOrigin(request)) return json({ error: "Origem não permitida." }, 403);
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") {
    return json({ error: "Formato de tentativa inválido." }, 400);
  }

  const payload = await request.json().catch(() => null);
  const guess = normalizeGuess(payload?.guess);
  if (!guess) return json({ error: "Digite uma palavra válida de cinco letras." }, 400);

  const clock = gameClock();
  if (payload.date !== clock.date) {
    return json({ error: "O desafio mudou. Atualize o tabuleiro para jogar." }, 409);
  }

  const answer = await dailyAnswer(env, clock.date);
  const marks = scoreGuess(guess, answer);
  const saved = await env.DB.prepare(`
    INSERT OR IGNORE INTO attempts (user_id, date, position, guess, marks, is_win)
    SELECT ?1, ?2, COUNT(*) + 1, ?3, ?4, ?5
    FROM attempts WHERE user_id = ?1 AND date = ?2
    HAVING COUNT(*) < 6 AND COALESCE(MAX(is_win), 0) = 0
  `).bind(user.user_id, clock.date, guess, JSON.stringify(marks), Number(guess === answer)).run();

  if (!saved.meta.changes) {
    return json({ error: "Palpite repetido ou desafio já encerrado." }, 409);
  }
  return readGame(env.DB, user, clock);
}
