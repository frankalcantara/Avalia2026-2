-- Contador de caracteres enviados ao Google TTS (controle de cota/custo).
-- Chaves: "m:YYYY-MM" (global, mês UTC) e "u:<userId>:YYYY-MM-DD" (por usuário, dia UTC).
CREATE TABLE IF NOT EXISTS tts_usage (
  period TEXT PRIMARY KEY,
  chars INTEGER NOT NULL DEFAULT 0
);
