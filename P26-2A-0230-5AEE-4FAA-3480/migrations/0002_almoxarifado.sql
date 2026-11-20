CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (
    typeof(quantity) = 'integer' AND quantity BETWEEN 0 AND 9007199254740991
  ),
  minimum_quantity INTEGER NOT NULL CHECK (
    typeof(minimum_quantity) = 'integer' AND minimum_quantity BETWEEN 0 AND 9007199254740991
  )
);

CREATE TABLE movements (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  type TEXT NOT NULL CHECK (type IN ('withdrawal', 'return')),
  quantity INTEGER NOT NULL CHECK (
    typeof(quantity) = 'integer' AND quantity BETWEEN 1 AND 9007199254740991
  ),
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, request_id)
);

-- O saldo e a auditoria são gravados na mesma operação SQLite.
-- Se o CHECK de saldo falhar, o INSERT da movimentação também é desfeito.
CREATE TRIGGER update_stock_on_movement
AFTER INSERT ON movements
FOR EACH ROW
BEGIN
  UPDATE items
     SET quantity = quantity + CASE NEW.type
       WHEN 'withdrawal' THEN -NEW.quantity
       ELSE NEW.quantity
     END
   WHERE id = NEW.item_id;
END;

INSERT INTO items (id, name, category, location, quantity, minimum_quantity) VALUES
  (1, 'ESP32 DevKit V1', 'Placas', 'Armário A · Gaveta 01', 12, 4),
  (2, 'Arduino Uno R3', 'Placas', 'Armário A · Gaveta 02', 5, 5),
  (3, 'Sensor DHT22', 'Sensores', 'Armário B · Gaveta 01', 2, 3),
  (4, 'Sensor ultrassônico HC-SR04', 'Sensores', 'Armário B · Gaveta 02', 10, 3),
  (5, 'Sensor de presença PIR', 'Sensores', 'Armário B · Gaveta 03', 8, 2),
  (6, 'Protoboard 830 pontos', 'Eletrônica', 'Armário C · Prateleira 01', 18, 5),
  (7, 'Kit de jumpers macho–macho', 'Eletrônica', 'Armário C · Prateleira 02', 14, 4),
  (8, 'LED vermelho 5 mm', 'Eletrônica', 'Armário C · Gaveta 01', 48, 10),
  (9, 'Resistor 220 Ω', 'Eletrônica', 'Armário C · Gaveta 02', 60, 15),
  (10, 'Multímetro digital', 'Ferramentas', 'Bancada de medições', 6, 2),
  (11, 'Ferro de solda 40 W', 'Ferramentas', 'Bancada de soldagem', 4, 2),
  (12, 'Alicate de corte de precisão', 'Ferramentas', 'Painel de ferramentas', 7, 2);
