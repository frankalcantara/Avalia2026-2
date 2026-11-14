-- Tabela para armazenar as estimativas de cada etapa (Módulo)
CREATE TABLE IF NOT EXISTS estimativas (
    fase TEXT PRIMARY KEY,
    horas_estimadas REAL NOT NULL
);

-- Tabela principal para armazenar os apontamentos de horas (Timesheet)
CREATE TABLE IF NOT EXISTS apontamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_user_id TEXT NOT NULL,
    discord_user_name TEXT NOT NULL,
    fase TEXT NOT NULL,
    horas_gastas REAL NOT NULL,
    tipo_registro TEXT NOT NULL, -- Pode ser 'manual' ou 'cronometro'
    data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fase) REFERENCES estimativas(fase)
);

-- Inserir os dados de estimativa inicial exigidos pelo projeto (Apenas se a tabela estiver vazia)
INSERT OR IGNORE INTO estimativas (fase, horas_estimadas) VALUES 
('Requisitos', 20.0),
('Arquitetura', 15.0),
('Codificacao', 40.0),
('Testes', 25.0);