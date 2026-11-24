CREATE TABLE IF NOT EXISTS quiz_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES quiz_categories(id),
  prompt TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option_id TEXT NOT NULL CHECK (correct_option_id IN ('a', 'b', 'c', 'd')),
  explanation TEXT NOT NULL,
  time_limit_seconds INTEGER NOT NULL DEFAULT 20 CHECK (time_limit_seconds BETWEEN 5 AND 120),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category ON quiz_questions(category_id, sort_order);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  category_id TEXT NOT NULL REFERENCES quiz_categories(id),
  current_question_id TEXT NOT NULL REFERENCES quiz_questions(id),
  question_index INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id, started_at);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id),
  question_id TEXT NOT NULL REFERENCES quiz_questions(id),
  option_id TEXT NOT NULL,
  correct_option_id TEXT NOT NULL,
  elapsed_seconds REAL NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attempt_id, question_id)
);

INSERT OR IGNORE INTO quiz_categories (id, name) VALUES ('matematica', 'Matemática'), ('ciencias', 'Ciências');

INSERT OR IGNORE INTO quiz_questions (id, category_id, prompt, option_a, option_b, option_c, option_d, correct_option_id, explanation, sort_order) VALUES
('mat-01', 'matematica', 'Quanto é 15% de 200?', '15', '20', '30', '40', 'c', '15% de 200 corresponde a 0,15 × 200 = 30.', 1),
('mat-02', 'matematica', 'Qual é a solução de 3x + 5 = 20?', '3', '5', '8', '15', 'b', 'Subtraindo 5 e dividindo por 3, obtemos x = 5.', 2),
('mat-03', 'matematica', 'A área de um triângulo com base 10 cm e altura 6 cm é:', '16 cm²', '30 cm²', '60 cm²', '80 cm²', 'b', 'A área é base × altura ÷ 2: 10 × 6 ÷ 2 = 30 cm².', 3),
('mat-04', 'matematica', 'Qual fração é equivalente a 0,75?', '1/4', '2/3', '3/4', '4/5', 'c', '0,75 = 75/100 = 3/4.', 4),
('mat-05', 'matematica', 'A média aritmética de 4, 6 e 8 é:', '5', '6', '7', '8', 'b', 'A média é (4 + 6 + 8) ÷ 3 = 6.', 5),
('cie-01', 'ciencias', 'Qual organela celular é responsável pela respiração celular?', 'Ribossomo', 'Mitocôndria', 'Lisossomo', 'Complexo de Golgi', 'b', 'A mitocôndria produz a maior parte do ATP durante a respiração celular.', 1),
('cie-02', 'ciencias', 'Qual gás as plantas absorvem principalmente na fotossíntese?', 'Oxigênio', 'Nitrogênio', 'Gás carbônico', 'Hidrogênio', 'c', 'As plantas absorvem CO₂ e água para produzir glicose e liberar oxigênio.', 2),
('cie-03', 'ciencias', 'Ao nível do mar, a água pura entra em ebulição a aproximadamente:', '0 °C', '50 °C', '100 °C', '212 °C', 'c', 'A pressão atmosférica ao nível do mar leva a água à ebulição em torno de 100 °C.', 3),
('cie-04', 'ciencias', 'Qual é a unidade básica da hereditariedade?', 'Célula', 'Gene', 'Tecido', 'Órgão', 'b', 'Genes são segmentos de DNA que carregam informação hereditária.', 4),
('cie-05', 'ciencias', 'Qual planeta é conhecido como Planeta Vermelho?', 'Vênus', 'Júpiter', 'Marte', 'Mercúrio', 'c', 'O óxido de ferro na superfície de Marte dá ao planeta sua aparência avermelhada.', 5);
