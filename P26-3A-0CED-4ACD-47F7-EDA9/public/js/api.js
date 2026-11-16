// Cliente HTTP das rotas /api/* (formato definido em docs/contrato-api.md)

const MENSAGENS = {
  unauthorized: "Sua sessão terminou. Entre de novo com o Discord.",
  invalid_mode: "Esse modo de jogo não existe.",
  invalid_date: "Data inválida.",
  before_launch: "O Cypher ainda não existia nesse dia.",
  future_date: "Esse cofre ainda está trancado. Volte no dia certo.",
  invalid_format: "Digite uma palavra de 5 letras.",
  not_a_word: "Essa palavra não está no dicionário.",
  game_over: "Esse cofre já foi encerrado.",
  not_found: "Não encontramos esse desafio.",
  own_challenge: "Você criou esse desafio, então não pode jogar nele.",
  forbidden: "Você não tem acesso a isso.",
  rate_limited: "Limite de desafios de hoje atingido. Tente amanhã.",
  server_misconfigured: "O servidor está sem configuração. Avise o responsável pelo jogo.",
  network: "Sem conexão. Confira sua internet e tente de novo.",
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", MENSAGENS.network);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const code = (data && data.error) || "unknown";
    const message = (data && data.message) || MENSAGENS[code] || "Algo deu errado. Tente de novo.";
    throw new ApiError(res.status, code, message);
  }
  return data;
}

const q = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const Api = {
  me: () => api("/api/me"),
  logout: () => api("/api/auth/logout", { method: "POST" }),
  game: (mode, date) => api(`/api/game${q({ mode, date })}`),
  guess: (mode, date, guess) => api("/api/guess", { method: "POST", body: { mode, date, guess } }),
  vaults: (mode) => api(`/api/vaults${q({ mode })}`),
  stats: (mode) => api(`/api/stats${q({ mode })}`),
  ranking: (mode, scope, guild, sort) => api(`/api/ranking${q({ mode, scope, guild, sort })}`),
  createChallenge: (word) => api("/api/challenge", { method: "POST", body: { word } }),
  myChallenges: () => api("/api/challenge"),
  challenge: (id) => api(`/api/challenge/${encodeURIComponent(id)}`),
  challengeGuess: (id, guess) => api(`/api/challenge/${encodeURIComponent(id)}/guess`, { method: "POST", body: { guess } }),
};
