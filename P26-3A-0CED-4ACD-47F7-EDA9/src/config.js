// Constantes do jogo Cypher
export const PROJECT_KEY = "P26-3A-0CED-4ACD-47F7-EDA9";
export const LAUNCH_DATE = "2026-11-01";
export const TIMEZONE = "America/Sao_Paulo";
export const WORD_LENGTH = 5;

// offset define o slot do modo no sorteio diário (slot = 2 * dia + offset)
export const MODES = {
  classico: { maxAttempts: 6, kind: "letters", offset: 0 },
  sombra: { maxAttempts: 10, kind: "counts", offset: 1 },
};

export const CHALLENGE_MAX_ATTEMPTS = 6;
export const CHALLENGE_DAILY_LIMIT = 20;
export const RECENT_SLOTS_BLOCK = 30;
export const RANKING_LIMIT = 50;

export const SESSION_COOKIE = "cypher_session";
export const OAUTH_COOKIE = "cypher_oauth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const OAUTH_MAX_AGE = 600;
