import {
  getSession,
  hasDatabase,
  jsonResponse,
  methodNotAllowed
} from '../_utils.js';

function parseAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  var text = String(value).trim().replace(',', '.');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) {
    return null;
  }
  var parts = text.split('.');
  var cents = Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0') || 0);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  var date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateTransaction(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'Envie os dados da transação em um objeto JSON.' };
  }
  if (data.type !== 'receita' && data.type !== 'despesa') {
    return { error: 'O tipo deve ser receita ou despesa.' };
  }
  var amountCents = parseAmount(data.amount);
  if (amountCents === null) {
    return { error: 'O valor deve ser positivo e ter no máximo duas casas decimais.' };
  }
  if (typeof data.category !== 'string' || !data.category.trim() || data.category.trim().length > 80) {
    return { error: 'Informe uma categoria com até 80 caracteres.' };
  }
  if (!isValidDate(data.date)) {
    return { error: 'Informe uma data válida no formato AAAA-MM-DD.' };
  }
  var description = data.description === undefined || data.description === null
    ? ''
    : data.description;
  if (typeof description !== 'string' || description.length > 300) {
    return { error: 'A descrição deve ter até 300 caracteres.' };
  }
  return {
    transaction: {
      type: data.type,
      amount_cents: amountCents,
      category: data.category.trim(),
      description: description.trim(),
      date: data.date
    }
  };
}

async function readJson(request) {
  try {
    return { data: await request.json() };
  } catch (error) {
    return { error: 'O corpo da requisição deve ser um JSON válido.' };
  }
}

function parseId(url) {
  var value = url.searchParams.get('id');
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  var id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

async function listTransactions(context, session, url) {
  var month = url.searchParams.get('month');
  var category = url.searchParams.get('category');
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return jsonResponse({ error: 'O mês deve estar no formato AAAA-MM.' }, 400);
  }
  if (category && category.length > 80) {
    return jsonResponse({ error: 'A categoria do filtro é muito longa.' }, 400);
  }

  var sql = 'SELECT id, type, amount_cents, category, description, date ' +
    'FROM transactions WHERE user_id = ?';
  var params = [session.user_id];
  if (month) {
    sql += ' AND substr(date, 1, 7) = ?';
    params.push(month);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY date DESC, id DESC';

  var transactionQuery = context.env.DB.prepare(sql);
  var rows = await transactionQuery.bind.apply(transactionQuery, params).all();
  var balance = await context.env.DB.prepare(
    'SELECT ' +
    'COALESCE(SUM(CASE WHEN type = ? THEN amount_cents ELSE 0 END), 0) AS income_cents, ' +
    'COALESCE(SUM(CASE WHEN type = ? THEN amount_cents ELSE 0 END), 0) AS expense_cents ' +
    'FROM transactions WHERE user_id = ?'
  ).bind('receita', 'despesa', session.user_id).first();

  return jsonResponse({
    transactions: rows.results || [],
    balance: {
      income_cents: balance.income_cents,
      expense_cents: balance.expense_cents,
      net_cents: balance.income_cents - balance.expense_cents
    }
  }, 200);
}

async function createTransaction(context, session, request) {
  var body = await readJson(request);
  if (body.error) {
    return jsonResponse({ error: body.error }, 400);
  }
  var validation = validateTransaction(body.data);
  if (validation.error) {
    return jsonResponse({ error: validation.error }, 400);
  }
  var transaction = validation.transaction;
  var result = await context.env.DB.prepare(
    'INSERT INTO transactions (user_id, type, amount_cents, category, description, date) ' +
    'VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    session.user_id,
    transaction.type,
    transaction.amount_cents,
    transaction.category,
    transaction.description,
    transaction.date
  ).run();
  return jsonResponse({ id: result.meta.last_row_id, message: 'Transação criada.' }, 201);
}

async function updateTransaction(context, session, request, url) {
  var id = parseId(url);
  if (!id) {
    return jsonResponse({ error: 'Informe um ID de transação válido.' }, 400);
  }
  var body = await readJson(request);
  if (body.error) {
    return jsonResponse({ error: body.error }, 400);
  }
  var validation = validateTransaction(body.data);
  if (validation.error) {
    return jsonResponse({ error: validation.error }, 400);
  }
  var transaction = validation.transaction;
  var result = await context.env.DB.prepare(
    'UPDATE transactions SET type = ?, amount_cents = ?, category = ?, description = ?, date = ? ' +
    'WHERE id = ? AND user_id = ?'
  ).bind(
    transaction.type,
    transaction.amount_cents,
    transaction.category,
    transaction.description,
    transaction.date,
    id,
    session.user_id
  ).run();
  if (!result.meta.changes) {
    return jsonResponse({ error: 'Transação não encontrada.' }, 404);
  }
  return jsonResponse({ message: 'Transação atualizada.' }, 200);
}

async function deleteTransaction(context, session, url) {
  var id = parseId(url);
  if (!id) {
    return jsonResponse({ error: 'Informe um ID de transação válido.' }, 400);
  }
  var result = await context.env.DB.prepare(
    'DELETE FROM transactions WHERE id = ? AND user_id = ?'
  ).bind(id, session.user_id).run();
  if (!result.meta.changes) {
    return jsonResponse({ error: 'Transação não encontrada.' }, 404);
  }
  return jsonResponse({ message: 'Transação excluída.' }, 200);
}

export async function onRequest(context) {
  var session;
  try {
    session = await getSession(context.request, context.env);
  } catch (error) {
    console.error('Falha ao validar a sessão financeira:', error);
    return jsonResponse({ error: 'Não foi possível validar a sessão.' }, 500);
  }
  if (!session) {
    return jsonResponse({ error: 'Autenticação necessária.' }, 401);
  }
  if (!hasDatabase(context.env)) {
    return jsonResponse({ error: 'O banco D1 não está configurado.' }, 503);
  }

  var url = new URL(context.request.url);
  try {
    if (context.request.method === 'GET') {
      return await listTransactions(context, session, url);
    }
    if (context.request.method === 'POST') {
      return await createTransaction(context, session, context.request);
    }
    if (context.request.method === 'PUT') {
      return await updateTransaction(context, session, context.request, url);
    }
    if (context.request.method === 'DELETE') {
      return await deleteTransaction(context, session, url);
    }
    return methodNotAllowed('GET, POST, PUT, DELETE');
  } catch (error) {
    console.error('Falha ao processar transação financeira:', error);
    return jsonResponse({ error: 'Não foi possível processar a transação.' }, 500);
  }
}
