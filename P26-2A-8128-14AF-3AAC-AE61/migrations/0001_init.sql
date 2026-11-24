-- EntreLivros, Projeto 24: P26-2A-8128-14AF-3AAC-AE61.
-- Migração inicial: nenhuma conta, sessão ou livro fictício em produção.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES users(user_id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY CHECK(length(state_hash) = 64),
  expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_states_expiry ON oauth_states(expires_at);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(user_id),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  author TEXT NOT NULL CHECK(length(trim(author)) BETWEEN 1 AND 200),
  category TEXT NOT NULL CHECK(category IN ('tecnico','literario')),
  condition TEXT NOT NULL CHECK(condition IN ('novo','bom','marcas')),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 1200),
  mode TEXT NOT NULL CHECK(mode IN ('emprestimo','troca','ambos')),
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK(status IN ('disponivel','reservado','emprestado')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX books_catalog ON books(deleted_at,status,category,created_at);
CREATE INDEX books_owner ON books(owner_id,deleted_at);

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  owner_id TEXT NOT NULL REFERENCES users(user_id),
  requester_id TEXT NOT NULL REFERENCES users(user_id),
  type TEXT NOT NULL CHECK(type IN ('emprestimo','troca')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','aprovado','recusado','cancelado','devolvido','concluido')),
  message TEXT NOT NULL DEFAULT '' CHECK(length(message) <= 800),
  offered_book_id TEXT REFERENCES books(id),
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(owner_id <> requester_id),
  CHECK((type = 'emprestimo' AND offered_book_id IS NULL) OR
        (type = 'troca' AND offered_book_id IS NOT NULL AND offered_book_id <> book_id)),
  CHECK(type <> 'emprestimo' OR status NOT IN ('aprovado','devolvido') OR due_date IS NOT NULL),
  CHECK(type = 'emprestimo' OR due_date IS NULL)
);
CREATE INDEX requests_incoming ON requests(owner_id,created_at);
CREATE INDEX requests_outgoing ON requests(requester_id,created_at);

-- Uma única trava por exemplar, incluindo livros oferecidos em troca.
-- A constraint impede concorrência cruzada entre empréstimos e trocas.
CREATE TABLE book_locks (
  book_id TEXT PRIMARY KEY REFERENCES books(id),
  request_id TEXT NOT NULL REFERENCES requests(id)
);
CREATE INDEX book_locks_request ON book_locks(request_id);

CREATE TRIGGER request_validate_insert BEFORE INSERT ON requests BEGIN
  SELECT CASE WHEN NEW.status <> 'pendente' THEN RAISE(ABORT,'invalid_transition') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM books WHERE id = NEW.book_id AND owner_id = NEW.owner_id
      AND owner_id <> NEW.requester_id AND deleted_at IS NULL AND status = 'disponivel'
      AND (mode = NEW.type OR mode = 'ambos')
  ) THEN RAISE(ABORT,'book_unavailable') END;
  SELECT CASE WHEN NEW.type = 'troca' AND NOT EXISTS (
    SELECT 1 FROM books WHERE id = NEW.offered_book_id AND owner_id = NEW.requester_id
      AND deleted_at IS NULL AND status = 'disponivel' AND mode IN ('troca','ambos')
  ) THEN RAISE(ABORT,'offered_book_unavailable') END;
END;

CREATE TRIGGER request_reserve AFTER INSERT ON requests BEGIN
  INSERT INTO book_locks(book_id,request_id) VALUES(NEW.book_id,NEW.id);
  INSERT INTO book_locks(book_id,request_id)
    SELECT NEW.offered_book_id,NEW.id WHERE NEW.offered_book_id IS NOT NULL;
  UPDATE books SET status = 'reservado', updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.book_id OR id = NEW.offered_book_id;
END;

CREATE TRIGGER request_validate_transition BEFORE UPDATE OF status ON requests
WHEN NEW.status <> OLD.status BEGIN
  SELECT CASE WHEN NOT (
    (OLD.status = 'pendente' AND NEW.status IN ('aprovado','recusado','cancelado')) OR
    (OLD.status = 'aprovado' AND OLD.type = 'emprestimo' AND NEW.status = 'devolvido') OR
    (OLD.status = 'aprovado' AND OLD.type = 'troca' AND NEW.status = 'concluido')
  ) THEN RAISE(ABORT,'invalid_transition') END;
  SELECT CASE WHEN NEW.status = 'aprovado' AND NEW.type = 'emprestimo'
    AND (NEW.due_date IS NULL OR date(NEW.due_date) IS NULL OR NEW.due_date <= date('now','-3 hours'))
    THEN RAISE(ABORT,'invalid_due_date') END;
END;

CREATE TRIGGER request_apply_transition AFTER UPDATE OF status ON requests
WHEN NEW.status <> OLD.status BEGIN
  UPDATE books SET status = 'emprestado', updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.book_id AND NEW.type = 'emprestimo' AND NEW.status = 'aprovado';
  UPDATE books SET owner_id = NEW.requester_id, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.book_id AND NEW.type = 'troca' AND NEW.status = 'concluido';
  UPDATE books SET owner_id = NEW.owner_id, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.offered_book_id AND NEW.type = 'troca' AND NEW.status = 'concluido';
  UPDATE books SET status = 'disponivel', updated_at = CURRENT_TIMESTAMP
    WHERE (id = NEW.book_id OR id = NEW.offered_book_id)
      AND NEW.status IN ('recusado','cancelado','devolvido','concluido');
  DELETE FROM book_locks WHERE request_id = NEW.id
    AND NEW.status IN ('recusado','cancelado','devolvido','concluido');
END;

-- Impede que uma edição/remoção concorrente invalide uma reserva confirmada.
CREATE TRIGGER book_protect_active BEFORE UPDATE OF title,author,category,condition,description,mode,deleted_at ON books
WHEN EXISTS(SELECT 1 FROM book_locks WHERE book_id = OLD.id) BEGIN
  SELECT RAISE(ABORT,'book_busy');
END;
