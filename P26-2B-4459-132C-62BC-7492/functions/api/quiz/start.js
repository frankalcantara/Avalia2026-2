// POST /api/quiz/start — sorteia as perguntas e embaralha as alternativas (no servidor).
import { ID_PATTERN, QUESTIONS_PER_QUIZ, START_LIMIT_PER_MIN } from '../../_lib/config.js';
import { randomToken, requireUser, shuffle } from '../../_lib/auth.js';
import { HttpError, handle, json, readJson } from '../../_lib/http.js';

export const onRequestPost = handle(
  async ({ request, env }) => {
    const user = await requireUser(request, env);
    const { categoryId } = await readJson(request);
    if (typeof categoryId !== 'string' || !ID_PATTERN.test(categoryId)) {
      throw new HttpError(400, 'invalid_body', 'categoryId inválido.');
    }

    const db = env.DB;
    const now = Date.now();

    const category = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(categoryId).first();
    if (!category) throw new HttpError(404, 'category_not_found', 'Categoria não encontrada.');

    // Limite de criação de quizzes por minuto (dificulta varrer o banco de questões).
    const recent = await db
      .prepare('SELECT COUNT(*) AS n FROM quiz_sessions WHERE user_id = ? AND created_at > ?')
      .bind(user.id, now - 60_000)
      .first();
    if (recent.n >= START_LIMIT_PER_MIN) {
      throw new HttpError(429, 'too_many_quizzes', 'Muitos quizzes iniciados. Aguarde um minuto.');
    }

    const { results: picked } = await db
      .prepare('SELECT id, time_limit_ms FROM questions WHERE category_id = ? ORDER BY RANDOM() LIMIT ?')
      .bind(categoryId, QUESTIONS_PER_QUIZ)
      .all();
    if (picked.length === 0) throw new HttpError(404, 'category_not_found', 'Categoria sem questões.');

    const quizId = randomToken(16);
    const statements = [
      db
        .prepare("UPDATE quiz_sessions SET status = 'abandoned', finished_at = ? WHERE user_id = ? AND status = 'active'")
        .bind(now, user.id),
      db
        .prepare("INSERT INTO quiz_sessions (id, user_id, category_id, total, score, status, created_at) VALUES (?, ?, ?, ?, 0, 'active', ?)")
        .bind(quizId, user.id, categoryId, picked.length, now),
      ...picked.map((q, i) =>
        db
          .prepare('INSERT INTO quiz_items (quiz_id, position, question_id, option_order, time_limit_ms) VALUES (?, ?, ?, ?, ?)')
          .bind(quizId, i, q.id, JSON.stringify(shuffle([0, 1, 2, 3])), q.time_limit_ms),
      ),
    ];

    try {
      await db.batch(statements); // transação única: tudo ou nada
    } catch (e) {
      if (/UNIQUE/i.test(String(e?.message))) {
        throw new HttpError(409, 'quiz_conflict', 'Outro quiz foi iniciado ao mesmo tempo. Tente novamente.');
      }
      throw e;
    }

    return json({ quizId, total: picked.length });
  },
  { post: true },
);
