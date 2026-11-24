// Regras de negócio dos livros: listagem com filtros, criação, edição e exclusão.
import { HttpError } from "./http.js";
import { validateBookInput, enumValue, CATEGORIES, MODES, BOOK_STATUSES, escapeLike, parseIdParam } from "./validate.js";
import { BOOK_SELECT, toBook, loadBook } from "./serialize.js";

export const MAX_BOOKS_PER_OWNER = 100;
const LIST_LIMIT = 200;

// GET /api/books?q=&category=&status=&mode=&owner=me
// me pode ser null (lista pública); owner=me exige login.
export async function listBooks(env, url, me) {
  const p = url.searchParams;
  const where = [];
  const binds = [];
  const get = (k) => (p.get(k) || "").trim();

  const q = get("q");
  if (q) {
    if (q.length > 100) throw new HttpError(400, "invalid_q", "Busca deve ter no máximo 100 caracteres.");
    const like = `%${escapeLike(q)}%`;
    where.push("(b.title LIKE ? ESCAPE '\\' OR b.author LIKE ? ESCAPE '\\')");
    binds.push(like, like);
  }
  if (get("category")) {
    where.push("b.category = ?");
    binds.push(enumValue(get("category"), "category", CATEGORIES));
  }
  if (get("status")) {
    where.push("b.status = ?");
    binds.push(enumValue(get("status"), "status", BOOK_STATUSES));
  }
  if (get("mode")) {
    // Filtro de modo inclui livros "ambos" (eles aceitam empréstimo e troca).
    const mode = enumValue(get("mode"), "mode", MODES);
    if (mode === "ambos") where.push("b.mode = 'ambos'");
    else {
      where.push("b.mode IN (?, 'ambos')");
      binds.push(mode);
    }
  }
  const owner = get("owner");
  if (owner) {
    if (owner !== "me") throw new HttpError(400, "invalid_owner", "Filtro owner aceita apenas 'me'.");
    if (!me) throw new HttpError(401, "unauthorized", "Faça login para ver seus livros.");
    where.push("b.owner_id = ?");
    binds.push(me.user_id);
  }

  const sql = `${BOOK_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""}
    ORDER BY b.created_at DESC, b.id DESC LIMIT ${LIST_LIMIT}`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return results.map((row) => toBook(row, me));
}

// POST /api/books — limite de 100 livros por dono garantido no próprio INSERT.
export async function createBook(env, me, body) {
  const b = validateBookInput(body);
  const res = await env.DB.prepare(
    `INSERT INTO books (owner_id, title, author, category, mode, condition, isbn, description)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      WHERE (SELECT COUNT(*) FROM books WHERE owner_id = ?1) < ?9`
  ).bind(me.user_id, b.title, b.author, b.category, b.mode, b.condition, b.isbn, b.description, MAX_BOOKS_PER_OWNER).run();
  if (res.meta.changes === 0) {
    throw new HttpError(429, "too_many_books", `Limite de ${MAX_BOOKS_PER_OWNER} livros por usuário atingido.`);
  }
  return loadBook(env, res.meta.last_row_id, me);
}

// Carrega e confere dono: 404 se não existe, 403 se não é do usuário.
async function loadOwned(env, rawId, me) {
  const id = parseIdParam(rawId);
  const row = await env.DB.prepare("SELECT id, owner_id, status FROM books WHERE id = ?").bind(id).first();
  if (!row) throw new HttpError(404, "not_found", "Livro não encontrado.");
  if (row.owner_id !== me.user_id) throw new HttpError(403, "forbidden", "Apenas o dono pode alterar este livro.");
  return row;
}

export async function getBook(env, rawId, me) {
  const book = await loadBook(env, parseIdParam(rawId), me);
  if (!book) throw new HttpError(404, "not_found", "Livro não encontrado.");
  return book;
}

// PATCH /api/books/:id — só campos descritivos (lista fixa de colunas, nunca vinda do cliente).
export async function updateBook(env, rawId, me, body) {
  const row = await loadOwned(env, rawId, me);
  const fields = validateBookInput(body, { partial: true });
  const cols = Object.keys(fields);
  if (cols.length === 0) throw new HttpError(400, "no_fields", "Nenhum campo editável enviado.");
  // Mudar o modo com pedido pendente/empréstimo em curso mudaria as regras no meio do caminho → 409.
  const changesMode = "mode" in fields;
  if (changesMode && row.status !== "Disponível") {
    throw new HttpError(409, "mode_locked", "Só é possível mudar o modo de um livro Disponível.");
  }
  const sets = cols.map((c) => `${c} = ?`).join(", ");
  const res = await env.DB.prepare(
    `UPDATE books SET ${sets}, updated_at = datetime('now') WHERE id = ? AND owner_id = ?` +
      (changesMode ? " AND status = 'Disponível'" : "")
  ).bind(...cols.map((c) => fields[c]), row.id, me.user_id).run();
  if (res.meta.changes === 0) throw new HttpError(409, "conflict", "O livro mudou de estado ou de dono; recarregue.");
  return loadBook(env, row.id, me);
}

// DELETE /api/books/:id — só se Disponível (condição no WHERE).
export async function deleteBook(env, rawId, me) {
  const row = await loadOwned(env, rawId, me);
  if (row.status !== "Disponível") throw new HttpError(409, "conflict", "Só é possível excluir livros disponíveis.");
  const res = await env.DB.prepare("DELETE FROM books WHERE id = ? AND owner_id = ? AND status = 'Disponível'")
    .bind(row.id, me.user_id).run();
  if (res.meta.changes === 0) throw new HttpError(409, "conflict", "O livro não está mais disponível.");
}
