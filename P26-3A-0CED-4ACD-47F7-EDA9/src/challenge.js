// Modo desafio: palavra escolhida por um jogador e compartilhada por link
import { CHALLENGE_DAILY_LIMIT, CHALLENGE_MAX_ATTEMPTS, WORD_LENGTH } from "./config.js";
import { displayOf } from "./dictionary.js";
import { letterFeedback, isWinningFeedback } from "./feedback.js";
import { parseGuess } from "./game.js";
import { HttpError } from "./http.js";

const ID_PATTERN = /^[A-Za-z0-9]{10}$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function newId() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function findChallenge(env, id) {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) throw new HttpError(404, "not_found", "Desafio não encontrado.");
  const row = await env.DB.prepare(
    `SELECT c.id, c.creator_id, c.word_key, c.created_at, u.username, u.avatar_url
       FROM challenges c JOIN users u ON u.user_id = c.creator_id WHERE c.id = ?`
  ).bind(id).first();
  if (!row) throw new HttpError(404, "not_found", "Desafio não encontrado.");
  return row;
}

export async function createChallenge(env, user, rawWord) {
  const key = parseGuess(rawWord);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM challenges WHERE creator_id = ? AND created_at > datetime('now', '-1 day')"
  ).bind(user.id).first();
  if (count.n >= CHALLENGE_DAILY_LIMIT) throw new HttpError(429, "rate_limited", "Limite de desafios por dia atingido.");
  const id = newId();
  await env.DB.prepare("INSERT INTO challenges (id, creator_id, word_key) VALUES (?, ?, ?)").bind(id, user.id, key).run();
  return { id, url: `/d/${id}` };
}

export async function listChallenges(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.word_key, c.created_at, COUNT(g.user_id) AS plays,
            COALESCE(SUM(CASE WHEN g.status = 'won' THEN 1 ELSE 0 END), 0) AS wins
       FROM challenges c LEFT JOIN challenge_games g ON g.challenge_id = c.id
      WHERE c.creator_id = ? GROUP BY c.id ORDER BY c.created_at DESC LIMIT 50`
  ).bind(user.id).all();
  return {
    challenges: results.map((r) => ({ id: r.id, word: displayOf(r.word_key), createdAt: r.created_at, plays: r.plays, wins: r.wins })),
  };
}

async function playerState(env, challenge, userId) {
  const game = await env.DB.prepare("SELECT * FROM challenge_games WHERE challenge_id = ? AND user_id = ?")
    .bind(challenge.id, userId).first();
  const { results } = await env.DB.prepare(
    "SELECT guess, feedback FROM challenge_guesses WHERE challenge_id = ? AND user_id = ? ORDER BY attempt_no"
  ).bind(challenge.id, userId).all();
  return { game, attempts: results.map((g) => ({ guess: g.guess, feedback: JSON.parse(g.feedback) })) };
}

function stateResponse(challenge, game, attempts) {
  const status = game ? game.status : "playing";
  return {
    id: challenge.id,
    isCreator: false,
    creator: { username: challenge.username, avatar: challenge.avatar_url },
    maxAttempts: CHALLENGE_MAX_ATTEMPTS,
    wordLength: WORD_LENGTH,
    status,
    attempts,
    answer: status !== "playing" ? displayOf(challenge.word_key) : null,
  };
}

export async function getChallenge(env, user, id) {
  const challenge = await findChallenge(env, id);
  if (challenge.creator_id === user.id) {
    const { results } = await env.DB.prepare(
      `SELECT u.username, u.avatar_url, g.status, g.attempts FROM challenge_games g
         JOIN users u ON u.user_id = g.user_id WHERE g.challenge_id = ? ORDER BY g.started_at`
    ).bind(challenge.id).all();
    return {
      id: challenge.id,
      isCreator: true,
      word: displayOf(challenge.word_key),
      creator: { username: challenge.username, avatar: challenge.avatar_url },
      plays: results.map((r) => ({ username: r.username, avatar: r.avatar_url, status: r.status, attempts: r.attempts })),
    };
  }
  const { game, attempts } = await playerState(env, challenge, user.id);
  return stateResponse(challenge, game, attempts);
}

export async function guessChallenge(env, user, id, rawGuess) {
  const challenge = await findChallenge(env, id);
  if (challenge.creator_id === user.id) throw new HttpError(403, "own_challenge", "Você não pode abrir o próprio cofre.");
  const key = parseGuess(rawGuess);

  let { game, attempts } = await playerState(env, challenge, user.id);
  if (game && game.status !== "playing") throw new HttpError(409, "game_over", "Esse desafio já foi encerrado.");
  if (!game) {
    await env.DB.prepare("INSERT OR IGNORE INTO challenge_games (challenge_id, user_id) VALUES (?, ?)")
      .bind(challenge.id, user.id).run();
    ({ game, attempts } = await playerState(env, challenge, user.id));
  }

  const attemptNo = game.attempts + 1;
  if (attemptNo > CHALLENGE_MAX_ATTEMPTS) throw new HttpError(409, "game_over", "Você já usou todas as tentativas.");
  const feedback = letterFeedback(challenge.word_key, key);
  const won = isWinningFeedback("letters", feedback, WORD_LENGTH);
  const status = won ? "won" : attemptNo >= CHALLENGE_MAX_ATTEMPTS ? "lost" : "playing";

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO challenge_guesses (challenge_id, user_id, attempt_no, guess, feedback) VALUES (?, ?, ?, ?, ?)")
        .bind(challenge.id, user.id, attemptNo, key, JSON.stringify(feedback)),
      env.DB.prepare(
        `UPDATE challenge_games SET attempts = ?, status = ?, finished_at = CASE WHEN ? <> 'playing' THEN datetime('now') END
          WHERE challenge_id = ? AND user_id = ? AND attempts = ?`
      ).bind(attemptNo, status, status, challenge.id, user.id, game.attempts),
    ]);
  } catch (err) {
    if (/UNIQUE|PRIMARY KEY|constraint/i.test(String(err && err.message))) {
      throw new HttpError(409, "conflict", "Outra tentativa foi enviada ao mesmo tempo. Recarregue o cofre.");
    }
    throw err;
  }
  return stateResponse(challenge, { ...game, status, attempts: attemptNo }, [...attempts, { guess: key, feedback }]);
}
