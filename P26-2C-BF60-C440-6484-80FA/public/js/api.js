// Helper único de acesso à API (docs/API.md). Nenhuma regra de negócio aqui:
// o servidor é a autoridade e o `message` dos erros é exibido como veio.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const FALLBACK_MESSAGES = {
  400: 'Os dados enviados não são válidos.',
  401: 'Você precisa entrar com o Discord para continuar.',
  403: 'Você não tem permissão para fazer isso.',
  404: 'Não encontrado.',
  409: 'O estado mudou enquanto você decidia. Atualize e tente de novo.',
  415: 'Formato de envio inválido.',
  429: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
};

/**
 * api('/api/books', { method: 'POST', body: {...}, signal })
 * - credentials: 'same-origin' sempre (cookie de sessão HttpOnly)
 * - Content-Type: application/json quando há corpo
 * - lança ApiError com o `message` do servidor em respostas não-2xx
 */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.');
  }

  let data = null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  }

  if (!res.ok) {
    const message = (data && typeof data.message === 'string' && data.message)
      || FALLBACK_MESSAGES[res.status]
      || `Erro inesperado no servidor (HTTP ${res.status}).`;
    throw new ApiError(res.status, (data && data.error) || `http_${res.status}`, message);
  }
  return data || {};
}
