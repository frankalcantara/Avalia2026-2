// Cliente da API (contrato: docs/ESPECIFICACAO.md). Só fetch + tratamento de erro.

export class ApiError extends Error {
  constructor(status, codigo, mensagem, campos = null) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    /** Em 400 de validação: { campo: "mensagem" }. */
    this.campos = campos;
  }
}

const MENSAGENS_PADRAO = {
  400: 'Confira os dados informados.',
  401: 'Você precisa entrar com o Discord para fazer isso.',
  403: 'Você não tem permissão para fazer isso.',
  404: 'Não encontramos o que você procurava.',
  409: 'Essa ação não é mais possível: a situação do item mudou.',
  413: 'O conteúdo enviado é grande demais.',
  415: 'Formato de envio não aceito.',
  429: 'Você fez muitos cadastros em pouco tempo. Tente de novo mais tarde.',
};

function mensagemPadrao(status) {
  if (MENSAGENS_PADRAO[status]) return MENSAGENS_PADRAO[status];
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';
  return 'Não foi possível concluir a operação.';
}

async function requisitar(metodo, caminho, { corpo, signal } = {}) {
  const opcoes = {
    method: metodo,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  };
  if (metodo === 'POST') {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo ?? {});
  }

  let resp;
  try {
    resp = await fetch(caminho, opcoes);
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'rede', 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.');
  }

  let dados = null;
  const tipo = resp.headers.get('content-type') ?? '';
  if (tipo.includes('application/json')) {
    try { dados = await resp.json(); } catch { dados = null; }
  }

  if (!resp.ok) {
    const msg = typeof dados?.mensagem === 'string' && dados.mensagem.trim() ? dados.mensagem : mensagemPadrao(resp.status);
    const codigo = typeof dados?.erro === 'string' ? dados.erro : `http_${resp.status}`;
    const campos = dados?.campos && typeof dados.campos === 'object' ? dados.campos : null;
    throw new ApiError(resp.status, codigo, msg, campos);
  }
  if (dados === null && resp.status !== 204) {
    throw new ApiError(resp.status, 'resposta_invalida', 'O servidor respondeu em um formato inesperado.');
  }
  return dados;
}

const id = (v) => encodeURIComponent(String(v));

export const api = {
  me: () => requisitar('GET', '/api/me'),
  sair: () => requisitar('POST', '/api/auth/logout'),

  listarItens(params, signal) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== null && v !== undefined) qs.set(k, String(v));
    }
    return requisitar('GET', `/api/itens?${qs}`, { signal });
  },
  obterItem: (itemId) => requisitar('GET', `/api/itens/${id(itemId)}`),
  criarItem: (dados) => requisitar('POST', '/api/itens', { corpo: dados }),
  apagarItem: (itemId) => requisitar('DELETE', `/api/itens/${id(itemId)}`),
  encerrarItem: (itemId) => requisitar('POST', `/api/itens/${id(itemId)}/encerrar`),
  reivindicar: (itemId, mensagem) => requisitar('POST', `/api/itens/${id(itemId)}/reivindicacoes`, { corpo: { mensagem } }),

  minhasReivindicacoes: () => requisitar('GET', '/api/reivindicacoes'),
  aceitar: (reivId) => requisitar('POST', `/api/reivindicacoes/${id(reivId)}/aceitar`),
  recusar: (reivId) => requisitar('POST', `/api/reivindicacoes/${id(reivId)}/recusar`),
  cancelar: (reivId) => requisitar('POST', `/api/reivindicacoes/${id(reivId)}/cancelar`),
};
