import { requireUser } from '../../../lib/auth.js';
import { fail, json, readJsonBody } from '../../../lib/http.js';

const MAX_HABITS_PER_USER = 30;
const MAX_NAME_LENGTH = 60;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = '#5eead4';

// POST /api/habits  { name, color? } — cadastra uma meta recorrente (validação no servidor).
export async function onRequestPost(context) {
  const auth = await requireUser(context, { mutation: true });
  if (auth.response) return auth.response;

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const rawName = parsed.body.name;
  if (typeof rawName !== 'string') return fail(400, 'Informe o nome do hábito.', 'invalid_name');
  // colapsa espaços e remove caracteres de controle
  const name = rawName.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    return fail(400, `O nome deve ter de 1 a ${MAX_NAME_LENGTH} caracteres.`, 'invalid_name');
  }

  let color = DEFAULT_COLOR;
  if (parsed.body.color !== undefined) {
    if (typeof parsed.body.color !== 'string' || !COLOR.test(parsed.body.color)) {
      return fail(400, 'Cor inválida. Use o formato #RRGGBB.', 'invalid_color');
    }
    color = parsed.body.color.toLowerCase();
  }

  const { env } = context;
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM habits WHERE user_id = ?').bind(auth.user.id).first('n');
  if (count >= MAX_HABITS_PER_USER) {
    return fail(409, `Limite de ${MAX_HABITS_PER_USER} hábitos atingido.`, 'habit_limit');
  }

  try {
    const result = await env.DB.prepare('INSERT INTO habits (user_id, name, color) VALUES (?, ?, ?)')
      .bind(auth.user.id, name, color)
      .run();
    return json({ habit: { id: result.meta.last_row_id, name, color } }, 201);
  } catch (err) {
    if (String(err?.message).includes('UNIQUE')) {
      return fail(409, 'Você já tem um hábito com esse nome.', 'duplicate_habit');
    }
    throw err;
  }
}
