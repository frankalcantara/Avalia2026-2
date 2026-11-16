import { authenticateRequest } from '../../lib/session.js';

const VALID_IMPEDIMENTOS = new Set(['sem', 'atencao', 'bloqueado']);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONTEUDO_LENGTH = 2000;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  const session = await authenticateRequest(request, env);

  if (!session) {
    return jsonResponse({ error: 'Não autenticado' }, 401);
  }

  if (!env?.DB) {
    return jsonResponse({ error: 'Banco de dados D1 não configurado' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido' }, 400);
  }

  const conteudo = typeof body?.conteudo === 'string' ? body.conteudo.trim() : '';
  const impedimento = typeof body?.impedimento === 'string' ? body.impedimento.trim() : '';

  if (!conteudo || !impedimento) {
    return jsonResponse({ error: 'Campos obrigatórios: conteudo, impedimento' }, 400);
  }

  if (conteudo.length > MAX_CONTEUDO_LENGTH) {
    return jsonResponse(
      { error: `O conteúdo deve ter no máximo ${MAX_CONTEUDO_LENGTH} caracteres` },
      400
    );
  }

  if (!VALID_IMPEDIMENTOS.has(impedimento)) {
    return jsonResponse(
      { error: 'Valor de impedimento inválido. Use: sem, atencao ou bloqueado' },
      400
    );
  }

  // Timestamp UTC gerado exclusivamente no servidor, ignorando qualquer data do cliente
  const criado_em = new Date().toISOString();

  try {
    const result = await env.DB.prepare(
      'INSERT INTO logs (user_id, username, avatar, conteudo, impedimento, criado_em) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(
        session.user_id,
        session.username,
        session.avatar || null,
        conteudo,
        impedimento,
        criado_em
      )
      .run();

    return jsonResponse(
      {
        success: true,
        id: result.meta?.last_row_id ?? null,
        criado_em,
      },
      201
    );
  } catch (error) {
    console.error('Erro ao inserir log:', error);
    return jsonResponse({ error: 'Erro interno do servidor' }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  const session = await authenticateRequest(request, env);

  if (!session) {
    return jsonResponse({ error: 'Não autenticado' }, 401);
  }

  if (!env?.DB) {
    return jsonResponse({ error: 'Banco de dados D1 não configurado' }, 503);
  }

  const url = new URL(request.url);
  const busca = (url.searchParams.get('busca') || '').trim();
  const inicio = (url.searchParams.get('inicio') || '').trim();
  const fim = (url.searchParams.get('fim') || '').trim();
  const impedimento = (url.searchParams.get('impedimento') || '').trim();

  if (inicio && !DATE_ONLY_REGEX.test(inicio)) {
    return jsonResponse({ error: 'Parâmetro inicio inválido. Use YYYY-MM-DD' }, 400);
  }

  if (fim && !DATE_ONLY_REGEX.test(fim)) {
    return jsonResponse({ error: 'Parâmetro fim inválido. Use YYYY-MM-DD' }, 400);
  }

  if (impedimento && !VALID_IMPEDIMENTOS.has(impedimento)) {
    return jsonResponse({ error: 'Parâmetro impedimento inválido' }, 400);
  }

  let query =
    'SELECT id, user_id, username, avatar, conteudo, impedimento, criado_em FROM logs WHERE user_id = ?';
  const params = [session.user_id];

  if (busca) {
    query += ' AND conteudo LIKE ?';
    params.push(`%${busca}%`);
  }

  if (impedimento) {
    query += ' AND impedimento = ?';
    params.push(impedimento);
  }

  if (inicio) {
    query += ' AND criado_em >= ?';
    params.push(`${inicio}T00:00:00.000Z`);
  }

  if (fim) {
    query += ' AND criado_em <= ?';
    params.push(`${fim}T23:59:59.999Z`);
  }

  query += ' ORDER BY criado_em DESC, id DESC';

  try {
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse(results || [], 200);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    return jsonResponse({ error: 'Erro interno do servidor' }, 500);
  }
}
