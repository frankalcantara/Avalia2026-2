// Leituras: calendário de cofres, estatísticas e ranking
import { LAUNCH_DATE, MODES, RANKING_LIMIT } from "./config.js";
import { addDays, today } from "./dates.js";
import { HttpError } from "./http.js";

// Streak exibido zera se a última vitória foi antes de ontem
function effectiveStreak(row, t) {
  if (!row.last_win_day || row.last_win_day < addDays(t, -1)) return 0;
  return row.current_streak;
}

export async function getVaults(env, user, mode) {
  const t = today();
  const { results } = await env.DB.prepare(
    "SELECT day, status, attempts, is_archive FROM games WHERE user_id = ? AND mode = ?"
  ).bind(user.id, mode).all();
  const byDay = new Map(results.map((r) => [r.day, r]));
  const days = [];
  for (let d = t; d >= LAUNCH_DATE; d = addDays(d, -1)) {
    const g = byDay.get(d);
    days.push({
      date: d,
      status: g ? g.status : "untouched",
      attempts: g ? g.attempts : 0,
      isArchive: g ? Boolean(g.is_archive) : d < t,
    });
  }
  return { mode, launchDate: LAUNCH_DATE, today: t, days };
}

export async function getStats(env, user, mode) {
  const row = await env.DB.prepare("SELECT * FROM user_stats WHERE user_id = ? AND mode = ?").bind(user.id, mode).first();
  const max = MODES[mode].maxAttempts;
  if (!row) {
    return { mode, played: 0, wins: 0, winRate: 0, currentStreak: 0, maxStreak: 0,
      distribution: new Array(max).fill(0), archive: { played: 0, wins: 0 } };
  }
  let dist = JSON.parse(row.distribution || "[]");
  if (!Array.isArray(dist) || dist.length !== max) dist = new Array(max).fill(0);
  return {
    mode,
    played: row.played,
    wins: row.wins,
    winRate: row.played ? Math.round((row.wins / row.played) * 100) : 0,
    currentStreak: effectiveStreak(row, today()),
    maxStreak: row.max_streak,
    distribution: dist,
    archive: { played: row.archive_played, wins: row.archive_wins },
  };
}

export async function getRanking(env, user, { mode, scope, guildId, sort }) {
  let guild = null;
  let sql = `SELECT s.*, u.username, u.avatar_url FROM user_stats s JOIN users u ON u.user_id = s.user_id
              WHERE s.mode = ? AND s.played > 0`;
  const binds = [mode];

  if (scope === "guild") {
    if (!guildId || !/^\d{1,25}$/.test(guildId)) throw new HttpError(400, "invalid_format", "Informe o servidor do Discord.");
    const member = await env.DB.prepare("SELECT guild_name FROM user_guilds WHERE user_id = ? AND guild_id = ?")
      .bind(user.id, guildId).first();
    if (!member) throw new HttpError(403, "forbidden", "Você não participa desse servidor.");
    guild = { id: guildId, name: member.guild_name };
    sql += " AND s.user_id IN (SELECT user_id FROM user_guilds WHERE guild_id = ?)";
    binds.push(guildId);
  } else if (scope !== "global") {
    throw new HttpError(400, "invalid_format", "Escopo de ranking inválido.");
  }

  const t = today();
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const rows = results.map((r) => ({
    userId: r.user_id,
    username: r.username,
    avatar: r.avatar_url,
    wins: r.wins,
    played: r.played,
    avgAttempts: r.wins ? Math.round((r.win_attempts_total / r.wins) * 10) / 10 : null,
    currentStreak: effectiveStreak(r, t),
    maxStreak: r.max_streak,
    isMe: r.user_id === user.id,
  }));

  const avg = (x) => (x.avgAttempts === null ? 99 : x.avgAttempts);
  rows.sort(sort === "streak"
    ? (a, b) => b.currentStreak - a.currentStreak || b.maxStreak - a.maxStreak || b.wins - a.wins
    : (a, b) => b.wins - a.wins || avg(a) - avg(b) || b.maxStreak - a.maxStreak);
  rows.forEach((r, i) => (r.rank = i + 1));

  const entries = rows.slice(0, RANKING_LIMIT);
  const mine = rows.find((r) => r.isMe);
  return { mode, scope, guild, sort, entries, me: mine && mine.rank > RANKING_LIMIT ? mine : null };
}
