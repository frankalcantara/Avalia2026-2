CREATE TRIGGER IF NOT EXISTS liberar_livros_troca_recusada
AFTER UPDATE OF status ON propostas_troca
WHEN NEW.status = 'Recusada'
BEGIN
  UPDATE livros
  SET status = 'Disponível'
  WHERE id IN (NEW.livro_alvo_id, NEW.livro_ofertado_id)
    AND status = 'Reservado';
END;
