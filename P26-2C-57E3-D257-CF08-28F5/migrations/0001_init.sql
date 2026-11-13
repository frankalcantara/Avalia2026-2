PRAGMA foreign_keys = ON;

CREATE TABLE discord_users (
  user_id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL CHECK (length(trim(username)) > 0),
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE CHECK (length(trim(nome)) > 0),
  categoria TEXT NOT NULL CHECK (length(trim(categoria)) > 0),
  descricao TEXT NOT NULL DEFAULT '',
  quantidade_atual INTEGER NOT NULL DEFAULT 0 CHECK (typeof(quantidade_atual) = 'integer' AND quantidade_atual >= 0),
  limite_minimo INTEGER NOT NULL DEFAULT 0 CHECK (typeof(limite_minimo) = 'integer' AND limite_minimo >= 0),
  unidade TEXT NOT NULL CHECK (length(trim(unidade)) > 0),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE transacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_item INTEGER NOT NULL REFERENCES itens(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  quantidade_movimentada INTEGER NOT NULL CHECK (typeof(quantidade_movimentada) = 'integer' AND quantidade_movimentada > 0),
  tipo_movimento TEXT NOT NULL CHECK (tipo_movimento IN ('retirada', 'devolucao')),
  user_id_discord TEXT NOT NULL REFERENCES discord_users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  username_discord TEXT NOT NULL CHECK (length(trim(username_discord)) > 0),
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_itens_categoria_nome ON itens (categoria, nome);
CREATE INDEX idx_transacoes_timestamp ON transacoes (timestamp DESC, id DESC);
CREATE INDEX idx_transacoes_item ON transacoes (id_item, timestamp DESC);
CREATE INDEX idx_transacoes_user ON transacoes (user_id_discord, timestamp DESC);

INSERT INTO itens (id, nome, categoria, descricao, quantidade_atual, limite_minimo, unidade) VALUES
  (1, 'ESP32 DevKit', 'Placas de Desenvolvimento', 'Placa de desenvolvimento Wi-Fi e Bluetooth.', 8, 3, 'un.'),
  (2, 'Arduino Uno', 'Placas de Desenvolvimento', 'Placa compatível com Arduino Uno.', 2, 4, 'un.'),
  (3, 'Sensor ultrassônico HC-SR04', 'Sensores', 'Sensor de distância ultrassônico.', 0, 2, 'un.'),
  (4, 'Sensor de temperatura DHT22', 'Sensores', 'Sensor digital de temperatura e umidade.', 6, 2, 'un.'),
  (5, 'Protoboard 830 pontos', 'Acessórios', 'Matriz de contatos para prototipagem.', 3, 5, 'un.'),
  (6, 'Kit de jumpers', 'Acessórios', 'Conjunto de fios jumper para protoboard.', 12, 4, 'kit'),
  (7, 'Multímetro digital', 'Ferramentas', 'Instrumento para medições elétricas.', 1, 1, 'un.');
