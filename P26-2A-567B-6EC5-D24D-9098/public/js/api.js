// public/js/api.js
// Camada de acesso à API. Toda chamada usa fetch com credentials: 'same-origin'
// (o cookie de sessão é HttpOnly; o JavaScript nunca o lê) e converte falhas
// em ApiError, preservando a mensagem de erro enviada pelo servidor ({ "error": "..." }).
// Nenhuma função envia user_id: o servidor usa o usuário da sessão.

/** Erro lançado quando a API (ou a rede) falha. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = falha de rede
  }
}

// Função chamada quando uma rota protegida responde 401 (sessão expirada).
let unauthorizedHandler = null;

/** Registra o que fazer quando a sessão expirar no meio do uso. */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

// Mensagens de reserva quando o servidor não envia {error}.
const FALLBACK_MESSAGES = {
  401: 'Você não está autenticado.',
  404: 'Recurso não encontrado.',
  405: 'Operação não suportada.',
  413: 'O conteúdo enviado é grande demais.',
  500: 'Erro interno do servidor.',
};

/**
 * Faz a requisição e devolve o JSON da resposta.
 * @param {string} path  Caminho da API (ex.: '/api/collections').
 * @param {{method?: string, body?: object, silent401?: boolean}} options
 */
async function request(path, { method = 'GET', body, silent401 = false } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  }

  // O corpo pode vir vazio ou não ser JSON; nesse caso seguimos com data = null.
  let data = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !silent401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      FALLBACK_MESSAGES[response.status] ||
      `Erro inesperado (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return data;
}

// Monta '/api/<recurso>/<id>' com o id codificado.
const withId = (base, id) => `${base}/${encodeURIComponent(id)}`;

/* ------------------------------ Autenticação ------------------------------ */

/** Usuário da sessão: { user_id, username, avatar }. Lança ApiError 401 se não houver sessão. */
export function getMe() {
  return request('/api/auth/me', { silent401: true });
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

/* -------------------------------- Coleções -------------------------------- */

/** → { collections: [...] } */
export function listCollections() {
  return request('/api/collections');
}

/** Entrada: { name, description? } → { collection } */
export function createCollection(payload) {
  return request('/api/collections', { method: 'POST', body: payload });
}

/** Entrada: { name?, description? } → { collection } */
export function updateCollection(id, payload) {
  return request(withId('/api/collections', id), { method: 'PATCH', body: payload });
}

/** Entrada: { is_public: boolean } → { collection } (com public_slug ou null) */
export function setVisibility(id, isPublic) {
  return request(`${withId('/api/collections', id)}/visibility`, {
    method: 'PATCH',
    body: { is_public: isPublic },
  });
}

/** Apaga a coleção e os links dela. → { ok: true } */
export function deleteCollection(id) {
  return request(withId('/api/collections', id), { method: 'DELETE' });
}

/* ---------------------------------- Links --------------------------------- */

/**
 * Filtros opcionais e combináveis. Valores vazios são omitidos (= sem filtro).
 * → { links: [...] }
 */
export function listLinks({ collectionId = '', status = '' } = {}) {
  const params = new URLSearchParams();
  if (collectionId !== '' && collectionId !== null) params.set('collection_id', String(collectionId));
  if (status) params.set('status', status);
  const query = params.toString();
  return request(`/api/links${query ? `?${query}` : ''}`);
}

/** Entrada: { collection_id, url, title, summary?, status? } → { link } */
export function createLink(payload) {
  return request('/api/links', { method: 'POST', body: payload });
}

/** Entrada: qualquer subconjunto de collection_id, url, title, summary, status → { link } */
export function updateLink(id, payload) {
  return request(withId('/api/links', id), { method: 'PATCH', body: payload });
}

export function deleteLink(id) {
  return request(withId('/api/links', id), { method: 'DELETE' });
}

/* ------------------------------ Coleção pública ---------------------------- */

/** SEM login. → { collection: { name, description, owner: { username, avatar } }, links: [...] } */
export function getPublic(slug) {
  return request(withId('/api/public', slug));
}