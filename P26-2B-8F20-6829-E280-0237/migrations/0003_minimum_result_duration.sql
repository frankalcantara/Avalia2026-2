CREATE TRIGGER IF NOT EXISTS trg_sudoku_results_min_duration_insert
BEFORE INSERT ON sudoku_results
FOR EACH ROW
WHEN NEW.elapsed_seconds < 30
BEGIN
  SELECT RAISE(ABORT, 'elapsed_seconds must be at least 30');
END;

CREATE TRIGGER IF NOT EXISTS trg_sudoku_results_min_duration_update
BEFORE UPDATE OF elapsed_seconds ON sudoku_results
FOR EACH ROW
WHEN NEW.elapsed_seconds < 30
BEGIN
  SELECT RAISE(ABORT, 'elapsed_seconds must be at least 30');
END;
