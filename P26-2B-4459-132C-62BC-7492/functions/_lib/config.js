// Constantes de regra de negócio — Chave Única: P26-2B-4459-132C-62BC-7492
export const QUESTIONS_PER_QUIZ = 10;      // perguntas por bateria
export const MAX_POINTS = 1000;            // acerto instantâneo
export const MIN_CORRECT_POINTS = 100;     // acerto no último instante
export const GRACE_MS = 500;               // tolerância de latência de rede ao ACEITAR uma resposta
export const START_LIMIT_PER_MIN = 6;      // quizzes iniciados por usuário por minuto
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_TTL_S = 600;

export const COOKIE_SID = 'sid';
export const COOKIE_STATE = 'oauth_state';

export const ID_PATTERN = /^[a-z0-9-]{1,40}$/;      // ids de categoria
export const QUIZ_ID_PATTERN = /^[0-9a-f]{32}$/;    // ids de quiz
