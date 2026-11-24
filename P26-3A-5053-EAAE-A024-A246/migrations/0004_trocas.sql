
CREATE TABLE IF NOT EXISTS propostas_troca (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  livro_alvo_id INTEGER NOT NULL
    REFERENCES livros(id),

  livro_ofertado_id INTEGER NOT NULL
    REFERENCES livros(id),

  proponente_id TEXT NOT NULL
    REFERENCES discord_users(user_id),

  dono_alvo_id TEXT NOT NULL
    REFERENCES discord_users(user_id),

  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (
      status IN (
        'Pendente',
        'Aceita',
        'Recusada',
        'Concluida',
        'Cancelada'
      )
    ),

  mensagem TEXT,

  criada_em TEXT NOT NULL DEFAULT (datetime('now')),
  decidida_em TEXT,
  concluida_em TEXT,

  CHECK (livro_alvo_id <> livro_ofertado_id),
  CHECK (proponente_id <> dono_alvo_id)
);

CREATE INDEX IF NOT EXISTS idx_trocas_proponente
  ON propostas_troca(proponente_id);

CREATE INDEX IF NOT EXISTS idx_trocas_dono_alvo
  ON propostas_troca(dono_alvo_id);

CREATE INDEX IF NOT EXISTS idx_trocas_livro_alvo
  ON propostas_troca(livro_alvo_id);

CREATE INDEX IF NOT EXISTS idx_trocas_livro_ofertado
  ON propostas_troca(livro_ofertado_id);

CREATE TRIGGER IF NOT EXISTS impedir_troca_com_negociacao_ativa
BEFORE INSERT ON propostas_troca
WHEN
  EXISTS (
    SELECT 1
    FROM propostas_troca t
    WHERE t.status IN ('Pendente', 'Aceita')
      AND (
        t.livro_alvo_id IN (NEW.livro_alvo_id, NEW.livro_ofertado_id)
        OR t.livro_ofertado_id IN (NEW.livro_alvo_id, NEW.livro_ofertado_id)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM emprestimos e
    WHERE e.livro_id IN (NEW.livro_alvo_id, NEW.livro_ofertado_id)
      AND e.status IN ('Pendente', 'Aprovado')
  )
BEGIN
  SELECT RAISE(ABORT, 'Um dos livros já possui uma negociação ativa.');
END;

CREATE TRIGGER IF NOT EXISTS impedir_emprestimo_durante_troca
BEFORE INSERT ON emprestimos
WHEN EXISTS (
  SELECT 1
  FROM propostas_troca t
  WHERE t.status IN ('Pendente', 'Aceita')
    AND (
      t.livro_alvo_id = NEW.livro_id
      OR t.livro_ofertado_id = NEW.livro_id
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Este livro já possui uma proposta de troca ativa.');
END;
