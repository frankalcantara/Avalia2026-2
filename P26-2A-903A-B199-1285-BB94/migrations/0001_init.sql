-- Esquema Cloudflare D1 para P26-2A-903A-B199-1285-BB94 (Projeto #32 - RSVP)

-- Tabela de Utilizadores (Autenticados via Discord)
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    avatar TEXT
);

-- Tabela de Eventos (Palestras, Grupos de Estudo)
CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    criador_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    local TEXT NOT NULL,
    data TEXT NOT NULL,
    horario TEXT NOT NULL,
    capacidade_maxima INTEGER NOT NULL,
    FOREIGN KEY (criador_id) REFERENCES usuarios(id)
);

-- Tabela de Inscrições e Fila de Espera (RSVP)
CREATE TABLE IF NOT EXISTS inscricoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmado', 'espera', 'cancelado')),
    data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices para otimizar as buscas no banco
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento ON inscricoes(evento_id);
CREATE INDEX IF NOT EXISTS idx_eventos_criador ON eventos(criador_id);