import { HttpError, json, readJson, stringField, enumField, assertKeys } from './http.js';
import { requireUser } from './auth.js';
import { bookSelect, getBook } from './books.js';
import { calendarDay } from './dates.js';

export const requestSelect = `SELECT r.id,r.book_id,b.title AS book_title,r.owner_id,r.requester_id,
  requester.display_name AS requester_name,requester.username AS requester_username,
  owner.display_name AS owner_name,owner.username AS owner_username,
  r.type,r.status,r.message,r.due_date,r.offered_book_id,offered.title AS offered_book_title,r.created_at
  FROM requests r JOIN books b ON b.id=r.book_id
  JOIN users requester ON requester.user_id=r.requester_id
  JOIN users owner ON owner.user_id=r.owner_id
  LEFT JOIN books offered ON offered.id=r.offered_book_id`;

export function getRequest(db, id) {
  return db.prepare(`${requestSelect} WHERE r.id=?`).bind(id).first();
}

export async function dashboard(request, env) {
  const user = await requireUser(request, env);
  const result = await env.DB.batch([
    env.DB.prepare(`${bookSelect} WHERE b.owner_id=? AND b.deleted_at IS NULL ORDER BY b.created_at DESC,b.id DESC`).bind(user.user_id),
    env.DB.prepare(`${requestSelect} WHERE r.owner_id=? ORDER BY r.created_at DESC,r.id DESC`).bind(user.user_id),
    env.DB.prepare(`${requestSelect} WHERE r.requester_id=? ORDER BY r.created_at DESC,r.id DESC`).bind(user.user_id),
  ]);
  return json({ books:result[0].results, incoming:result[1].results, outgoing:result[2].results });
}

export async function createRequest(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  assertKeys(body, ['book_id','type','message','offered_book_id']);
  const bookId = stringField(body.book_id, 'Livro', 100);
  const type = enumField(body.type, ['emprestimo','troca'], 'Tipo de pedido');
  const message = stringField(body.message, 'Mensagem', 800, false);
  const offeredId = type === 'troca' ? stringField(body.offered_book_id, 'Livro oferecido', 100) : null;
  if (type === 'emprestimo' && body.offered_book_id != null) {
    throw new HttpError(400, 'Empréstimos não incluem livro oferecido em troca.');
  }
  const book = await getBook(env.DB,bookId);
  if (!book) throw new HttpError(404, 'Livro não encontrado.');
  if (book.owner_id === user.user_id) throw new HttpError(400, 'Você não pode solicitar o próprio livro.');
  if (book.status !== 'disponivel') throw new HttpError(409, 'Este livro não está disponível.');
  if (book.mode !== type && book.mode !== 'ambos') throw new HttpError(400, 'O livro não aceita essa modalidade.');
  if (offeredId) {
    const offered = await getBook(env.DB,offeredId);
    if (!offered) throw new HttpError(404, 'Livro oferecido não encontrado.');
    if (offered.owner_id !== user.user_id) throw new HttpError(403, 'Você só pode oferecer um livro do seu acervo.');
    if (offered.status !== 'disponivel') throw new HttpError(409, 'O livro oferecido não está disponível.');
    if (!['troca','ambos'].includes(offered.mode)) throw new HttpError(400, 'O livro oferecido precisa aceitar troca.');
  }
  const id = crypto.randomUUID();
  // Uma instrução e seus triggers: ambas as reservas são confirmadas ou revertidas juntas.
  await env.DB.prepare('INSERT INTO requests(id,book_id,owner_id,requester_id,type,message,offered_book_id) VALUES(?,?,?,?,?,?,?)')
    .bind(id,bookId,book.owner_id,user.user_id,type,message,offeredId).run();
  return json({request:await getRequest(env.DB,id)}, 201);
}

function validateDueDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Informe uma data de devolução no formato AAAA-MM-DD.');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0,10) !== value) {
    throw new HttpError(400, 'Data de devolução inválida.');
  }
  const today = calendarDay();
  const maximum = calendarDay(365);
  if (value <= today || value > maximum) throw new HttpError(400, 'A devolução deve ocorrer a partir de amanhã, em até 365 dias.');
  return value;
}

export async function changeRequest(request, env, id) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  assertKeys(body, ['action','due_date']);
  const action = enumField(body.action, ['approve','reject','cancel','return','complete_exchange'], 'Ação');
  const row = await getRequest(env.DB,id);
  if (!row) throw new HttpError(404, 'Pedido não encontrado.');
  const expectedUser = action === 'cancel' ? row.requester_id : row.owner_id;
  if (user.user_id !== expectedUser) throw new HttpError(403, 'Você não tem permissão para esta ação.');
  const transition = {
    approve: ['pendente','aprovado'], reject: ['pendente','recusado'], cancel: ['pendente','cancelado'],
    return: ['aprovado','devolvido'], complete_exchange: ['aprovado','concluido'],
  }[action];
  if (row.status !== transition[0]) throw new HttpError(409, 'Este pedido já mudou de situação. Atualize a página.');
  if ((action === 'return' && row.type !== 'emprestimo') || (action === 'complete_exchange' && row.type !== 'troca')) {
    throw new HttpError(400, 'A ação não corresponde ao tipo deste pedido.');
  }
  let dueDate = row.due_date;
  if (action === 'approve' && row.type === 'emprestimo') dueDate = validateDueDate(body.due_date);
  else if (body.due_date != null) throw new HttpError(400, 'A data de devolução só é definida ao aprovar um empréstimo.');
  const result = await env.DB.prepare('UPDATE requests SET status=?,due_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?')
    .bind(transition[1],dueDate,id,transition[0]).run();
  if (result.meta.changes < 1) throw new HttpError(409, 'Este pedido já mudou de situação. Atualize a página.');
  return json({request:await getRequest(env.DB,id)});
}
