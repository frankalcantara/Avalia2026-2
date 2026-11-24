// Regras de negócio dos pedidos (máquina de estados de docs/API.md).
// Toda transição é um env.DB.batch (transação) com guardas "WHERE status = ?" e
// conferência de meta.changes; zero mudanças = outro pedido venceu → 409.
import { HttpError } from "./http.js";
import { parseIdField, optionalString, enumValue, REQUEST_TYPES, validateDueDate } from "./validate.js";
import { loadRequest } from "./serialize.js";

export const MAX_PENDING_PER_USER = 3;

const conflict = (msg = "O estado mudou; recarregue e tente novamente.") => new HttpError(409, "conflict", msg);

// Modos de livro que aceitam cada tipo de pedido.
const MODES_FOR_TYPE = { emprestimo: ["emprestimo", "ambos"], troca: ["troca", "ambos"] };

async function pendingCount(env, userId) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE requester_id = ? AND status = 'pendente'")
    .bind(userId).first();
  return Number(row?.n || 0);
}

// POST /api/requests
export async function createRequest(env, me, body) {
  const bookId = parseIdField(body.book_id, "book_id");
  const type = enumValue(body.type, "type", REQUEST_TYPES);
  const message = optionalString(body.message, "message", 500);
  let offeredId = null;
  const offeredRaw = body.offered_book_id;
  if (offeredRaw !== undefined && offeredRaw !== null && offeredRaw !== "") {
    if (type !== "troca") throw new HttpError(400, "invalid_offered_book_id", "offered_book_id só é permitido em pedidos de troca.");
    offeredId = parseIdField(offeredRaw, "offered_book_id");
  }

  // Pré-checagens para devolver o código de erro certo (a garantia real está no batch abaixo).
  const book = await env.DB.prepare("SELECT id, owner_id, mode, status FROM books WHERE id = ?").bind(bookId).first();
  if (!book) throw new HttpError(404, "not_found", "Livro não encontrado.");
  if (book.owner_id === me.user_id) throw new HttpError(403, "own_book", "Você não pode pedir o seu próprio livro.");
  if (!MODES_FOR_TYPE[type].includes(book.mode)) {
    throw new HttpError(400, "mode_not_allowed", "Este livro não aceita esse tipo de pedido.");
  }
  if (book.status !== "Disponível") throw conflict("Este livro não está disponível.");
  if (offeredId !== null) {
    const off = await env.DB.prepare("SELECT id, owner_id, status FROM books WHERE id = ?").bind(offeredId).first();
    if (!off) throw new HttpError(404, "not_found", "Livro oferecido não encontrado.");
    if (off.owner_id !== me.user_id) throw new HttpError(403, "not_your_book", "O livro oferecido precisa ser seu.");
    if (off.status !== "Disponível") throw conflict("O livro oferecido não está disponível.");
  }
  if ((await pendingCount(env, me.user_id)) >= MAX_PENDING_PER_USER) {
    throw new HttpError(429, "too_many_pending", `Você já tem ${MAX_PENDING_PER_USER} pedidos pendentes.`);
  }

  // ?1 livro, ?2 solicitante, ?3 tipo, ?4 oferecido, ?5 mensagem, ?6/?7 modos aceitos, ?8 limite
  const [m1, m2] = MODES_FOR_TYPE[type];
  const stmts = [
    env.DB.prepare(
      `INSERT INTO requests (book_id, requester_id, owner_id, type, offered_book_id, message)
       SELECT b.id, ?2, b.owner_id, ?3, ?4, ?5 FROM books b
        WHERE b.id = ?1 AND b.status = 'Disponível' AND b.owner_id <> ?2 AND b.mode IN (?6, ?7)
          AND (SELECT COUNT(*) FROM requests WHERE requester_id = ?2 AND status = 'pendente') < ?8
          AND (?4 IS NULL OR EXISTS (SELECT 1 FROM books x
                WHERE x.id = ?4 AND x.owner_id = ?2 AND x.status = 'Disponível'))`
    ).bind(bookId, me.user_id, type, offeredId, message, m1, m2, MAX_PENDING_PER_USER),
    // Só reserva se o INSERT acima aconteceu (existe o pedido pendente deste solicitante).
    env.DB.prepare(
      `UPDATE books SET status = 'Reservado', updated_at = datetime('now')
        WHERE id = ?1 AND status = 'Disponível'
          AND EXISTS (SELECT 1 FROM requests WHERE book_id = ?1 AND requester_id = ?2 AND status = 'pendente')`
    ).bind(bookId, me.user_id),
  ];
  if (offeredId !== null) {
    stmts.push(
      env.DB.prepare(
        `UPDATE books SET status = 'Reservado', updated_at = datetime('now')
          WHERE id = ?3 AND owner_id = ?2 AND status = 'Disponível'
            AND EXISTS (SELECT 1 FROM requests WHERE book_id = ?1 AND requester_id = ?2
                         AND status = 'pendente' AND offered_book_id = ?3)`
      ).bind(bookId, me.user_id, offeredId)
    );
  }

  const results = await env.DB.batch(stmts); // UNIQUE do índice parcial vira 409 em route()
  if (results[0].meta.changes === 0) {
    if ((await pendingCount(env, me.user_id)) >= MAX_PENDING_PER_USER) {
      throw new HttpError(429, "too_many_pending", `Você já tem ${MAX_PENDING_PER_USER} pedidos pendentes.`);
    }
    throw conflict("O livro deixou de estar disponível.");
  }
  if (results.slice(1).some((r) => r.meta.changes === 0)) {
    console.error("Inconsistência ao reservar livros do pedido", results.map((r) => r.meta.changes));
  }
  return loadRequest(env, results[0].meta.last_row_id);
}

// Carrega o pedido e confere quem pode agir: "owner" ou "requester".
async function loadForActor(env, id, me, actor) {
  const r = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
  if (!r) throw new HttpError(404, "not_found", "Pedido não encontrado.");
  const allowed = actor === "owner" ? r.owner_id === me.user_id : r.requester_id === me.user_id;
  if (!allowed) {
    const who = actor === "owner" ? "o dono do livro" : "quem fez o pedido";
    throw new HttpError(403, "forbidden", `Apenas ${who} pode fazer isso.`);
  }
  return r;
}

// Libera um livro reservado, desde que não exista mais nenhum pedido pendente envolvendo-o.
function releaseBook(env, bookId) {
  return env.DB.prepare(
    `UPDATE books SET status = 'Disponível', updated_at = datetime('now')
      WHERE id = ?1 AND status = 'Reservado'
        AND NOT EXISTS (SELECT 1 FROM requests WHERE status = 'pendente' AND (book_id = ?1 OR offered_book_id = ?1))`
  ).bind(bookId);
}

function checkFirst(results) {
  if (results[0].meta.changes === 0) throw conflict("Este pedido não está mais no estado esperado.");
  if (results.slice(1).some((x) => x.meta.changes === 0)) {
    console.error("Inconsistência em transição de pedido", results.map((x) => x.meta.changes));
  }
}

// Recusar (dono) ou cancelar (solicitante): pedido pendente → recusado/cancelado; livros → Disponível.
async function closePending(env, id, me, actor, newStatus) {
  const r = await loadForActor(env, id, me, actor);
  if (r.status !== "pendente") throw conflict("Só é possível alterar pedidos pendentes.");
  const stmts = [
    env.DB.prepare(
      `UPDATE requests SET status = ?2, decided_at = datetime('now') WHERE id = ?1 AND status = 'pendente'`
    ).bind(id, newStatus),
    releaseBook(env, r.book_id),
  ];
  if (r.offered_book_id) stmts.push(releaseBook(env, r.offered_book_id));
  checkFirst(await env.DB.batch(stmts));
  return loadRequest(env, id);
}

export const rejectRequest = (env, id, me) => closePending(env, id, me, "owner", "recusado");
export const cancelRequest = (env, id, me) => closePending(env, id, me, "requester", "cancelado");

// Aprovar (dono): empréstimo → aprovado + Emprestado; troca → concluido + troca de donos.
export async function approveRequest(env, id, me, body) {
  const r = await loadForActor(env, id, me, "owner");
  if (r.status !== "pendente") throw conflict("Só é possível aprovar pedidos pendentes.");
  const [m1, m2] = MODES_FOR_TYPE[r.type];
  const book = await env.DB.prepare("SELECT mode FROM books WHERE id = ?").bind(r.book_id).first();
  if (!book || !MODES_FOR_TYPE[r.type].includes(book.mode)) {
    throw conflict("O modo do livro não aceita mais este tipo de pedido.");
  }
  // Guarda do 1º statement: o livro continua Reservado e com modo compatível com o tipo do pedido.
  const bookGuard = `EXISTS (SELECT 1 FROM books WHERE id = ?3 AND status = 'Reservado' AND mode IN (?4, ?5))`;

  let stmts;
  if (r.type === "emprestimo") {
    const due = validateDueDate(body.due_date);
    stmts = [
      env.DB.prepare(
        `UPDATE requests SET status = 'aprovado', due_date = ?2, decided_at = datetime('now')
          WHERE id = ?1 AND status = 'pendente' AND ${bookGuard}`
      ).bind(id, due, r.book_id, m1, m2),
      env.DB.prepare(
        `UPDATE books SET status = 'Emprestado', holder_id = ?2, due_date = ?3, updated_at = datetime('now')
          WHERE id = ?1 AND status = 'Reservado' AND owner_id = ?4
            AND EXISTS (SELECT 1 FROM requests WHERE id = ?5 AND status = 'aprovado')
            AND NOT EXISTS (SELECT 1 FROM requests WHERE book_id = ?1 AND status = 'pendente')`
      ).bind(r.book_id, r.requester_id, due, r.owner_id, id),
    ];
  } else {
    // Troca: o livro pedido vai para o solicitante; o oferecido (se houver) vai para o dono.
    stmts = [
      env.DB.prepare(
        `UPDATE requests SET status = 'concluido', decided_at = datetime('now')
          WHERE id = ?1 AND status = 'pendente' AND ${bookGuard}`
      ).bind(id, null, r.book_id, m1, m2),
      env.DB.prepare(
        `UPDATE books SET owner_id = ?2, status = 'Disponível', holder_id = NULL, due_date = NULL, updated_at = datetime('now')
          WHERE id = ?1 AND status = 'Reservado' AND owner_id = ?3
            AND EXISTS (SELECT 1 FROM requests WHERE id = ?4 AND status = 'concluido')
            AND NOT EXISTS (SELECT 1 FROM requests WHERE status = 'pendente' AND (book_id = ?1 OR offered_book_id = ?1))`
      ).bind(r.book_id, r.requester_id, r.owner_id, id),
    ];
    if (r.offered_book_id) {
      stmts.push(
        env.DB.prepare(
          `UPDATE books SET owner_id = ?2, status = 'Disponível', holder_id = NULL, due_date = NULL, updated_at = datetime('now')
            WHERE id = ?1 AND status = 'Reservado' AND owner_id = ?3
              AND EXISTS (SELECT 1 FROM requests WHERE id = ?4 AND status = 'concluido')
              AND NOT EXISTS (SELECT 1 FROM requests WHERE status = 'pendente' AND (book_id = ?1 OR offered_book_id = ?1))`
        ).bind(r.offered_book_id, r.owner_id, r.requester_id, id)
      );
    }
  }
  checkFirst(await env.DB.batch(stmts));
  return loadRequest(env, id);
}

// Registrar devolução (dono): empréstimo aprovado → devolvido; livro → Disponível.
export async function returnRequest(env, id, me) {
  const r = await loadForActor(env, id, me, "owner");
  if (r.type !== "emprestimo" || r.status !== "aprovado") {
    throw conflict("Só é possível registrar devolução de empréstimo aprovado.");
  }
  const stmts = [
    env.DB.prepare(
      `UPDATE requests SET status = 'devolvido', returned_at = datetime('now')
        WHERE id = ?1 AND status = 'aprovado' AND type = 'emprestimo'`
    ).bind(id),
    env.DB.prepare(
      `UPDATE books SET status = 'Disponível', holder_id = NULL, due_date = NULL, updated_at = datetime('now')
        WHERE id = ?1 AND status = 'Emprestado' AND holder_id = ?2
          AND NOT EXISTS (SELECT 1 FROM requests WHERE book_id = ?1 AND type = 'emprestimo' AND status = 'aprovado')`
    ).bind(r.book_id, r.requester_id),
  ];
  checkFirst(await env.DB.batch(stmts));
  return loadRequest(env, id);
}
