// Wrapper de fetch para as rotas /api (contrato em docs/SPEC.md, seção 4).

/** Erro com status HTTP e código do servidor ({ ok:false, error, message }). */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body) {
  const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new ApiError(0, 'rede', 'Falha de conexão. Verifique sua internet e tente novamente.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* resposta sem JSON */ }
  if (!res.ok || !data || data.ok === false) {
    throw new ApiError(
      res.status,
      data?.error || 'erro_desconhecido',
      data?.message || `Erro inesperado (HTTP ${res.status}).`
    );
  }
  return data;
}

export const api = {
  me: () => request('GET', '/api/me'),
  logout: () => request('POST', '/api/auth/logout', {}),
  listarEnquetes: () => request('GET', '/api/polls'),
  obterEnquete: (id) => request('GET', `/api/polls/${encodeURIComponent(id)}`),
  criarEnquete: (dados) => request('POST', '/api/polls', dados),
  votar: (id, optionId) => request('POST', `/api/polls/${encodeURIComponent(id)}/vote`, { option_id: optionId }),
};
