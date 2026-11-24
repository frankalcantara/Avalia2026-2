CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INTEGER NOT NULL DEFAULT 0 CHECK (min_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('withdrawal', 'return')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES discord_users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_movements_item_id ON movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_user_id ON movements(user_id);

INSERT OR IGNORE INTO items (name, category, description, unit, quantity, min_quantity) VALUES
  ('Cabo HDMI', 'Cabos e adaptadores', 'Cabo HDMI para conexão de monitores e projetores.', 'unidade', 20, 5),
  ('Adaptador USB-C', 'Cabos e adaptadores', 'Adaptador USB-C para USB-A.', 'unidade', 12, 3),
  ('Mouse óptico', 'Periféricos', 'Mouse óptico USB para uso em laboratório.', 'unidade', 15, 4),
  ('Teclado USB', 'Periféricos', 'Teclado USB padrão ABNT2.', 'unidade', 10, 3),
  ('Memória DDR4 8 GB', 'Componentes', 'Módulo de memória DDR4 de 8 GB.', 'módulo', 8, 2),
  ('SSD SATA 240 GB', 'Componentes', 'Unidade SSD SATA de 240 GB.', 'unidade', 6, 2),
  ('Fonte ATX 500 W', 'Componentes', 'Fonte de alimentação ATX de 500 W.', 'unidade', 5, 1),
  ('Pendrive 32 GB', 'Armazenamento', 'Pendrive USB de 32 GB.', 'unidade', 10, 3),
  ('ESP32 DevKit V1', 'Placas de desenvolvimento', 'Placa ESP32 com conectividade Wi-Fi e Bluetooth.', 'placa', 8, 2),
  ('Arduino Uno R3', 'Placas de desenvolvimento', 'Placa Arduino Uno R3 para prototipagem.', 'placa', 6, 2),
  ('Sensor de temperatura DHT22', 'Sensores', 'Sensor digital de temperatura e umidade.', 'sensor', 5, 2),
  ('Sensor ultrassônico HC-SR04', 'Sensores', 'Sensor de distância ultrassônico.', 'sensor', 8, 2),
  ('Resistor 220 ohms', 'Componentes eletrônicos', 'Resistor de 220 ohms para prototipagem.', 'unidade', 500, 100),
  ('LED vermelho 5 mm', 'Componentes eletrônicos', 'LED vermelho difuso de 5 mm.', 'unidade', 200, 50),
  ('Protoboard 830 pontos', 'Componentes eletrônicos', 'Matriz de contatos para prototipagem sem solda.', 'unidade', 10, 3),
  ('Jumper macho-macho', 'Componentes eletrônicos', 'Fios jumper para conexão em protoboard.', 'unidade', 150, 30),
  ('Multímetro digital', 'Ferramentas', 'Multímetro digital para medições elétricas.', 'ferramenta', 4, 1),
  ('Jogo de chaves de precisão', 'Ferramentas', 'Conjunto de chaves para manutenção de placas e equipamentos.', 'jogo', 6, 2),
  ('Ferro de solda 40 W', 'Ferramentas', 'Ferro de solda para montagem e reparo eletrônico.', 'ferramenta', 3, 1);
