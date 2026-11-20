CREATE TRIGGER liberar_livros_troca_cancelada
AFTER UPDATE OF status ON propostas_troca
FOR EACH ROW
WHEN OLD.status = 'Pendente'
 AND NEW.status = 'Cancelada'
BEGIN
  UPDATE livros
  SET status = 'Disponível'
  WHERE id IN (
    NEW.livro_alvo_id,
    NEW.livro_ofertado_id
  )
  AND status = 'Reservado';
END;