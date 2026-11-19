
CREATE TRIGGER IF NOT EXISTS validar_conclusao_troca
BEFORE UPDATE OF status ON propostas_troca
WHEN NEW.status = 'Concluida'
BEGIN
  SELECT CASE
    WHEN OLD.status <> 'Aceita'
      THEN RAISE(ABORT, 'A proposta precisa estar aceita.')
    WHEN NEW.confirmada_proponente_em IS NULL
      OR NEW.confirmada_dono_em IS NULL
      THEN RAISE(ABORT, 'Faltam confirmações.')
    WHEN (
      SELECT COUNT(*)
      FROM livros
      WHERE id IN (NEW.livro_alvo_id, NEW.livro_ofertado_id)
        AND status = 'Reservado'
    ) <> 2
      THEN RAISE(ABORT, 'Os dois livros precisam estar reservados.')
  END;
END;

CREATE TRIGGER IF NOT EXISTS transferir_livros_troca
AFTER UPDATE OF status ON propostas_troca
WHEN NEW.status = 'Concluida'
BEGIN
  UPDATE livros
  SET
    dono_id = CASE
      WHEN id = NEW.livro_alvo_id THEN NEW.proponente_id
      WHEN id = NEW.livro_ofertado_id THEN NEW.dono_alvo_id
    END,
    status = 'Disponível'
  WHERE id IN (NEW.livro_alvo_id, NEW.livro_ofertado_id);
END;
