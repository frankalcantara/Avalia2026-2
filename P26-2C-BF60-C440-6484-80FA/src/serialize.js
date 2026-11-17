// Consultas com joins e formatação dos objetos Book e Request do contrato (docs/API.md).

const userCols = (alias, prefix) =>
  `${alias}.user_id AS ${prefix}_user_id, ${alias}.username AS ${prefix}_username, ` +
  `${alias}.display_name AS ${prefix}_display_name, ${alias}.avatar_url AS ${prefix}_avatar_url`;

// SELECT base de livros com dono e portador (holder) já unidos.
export const BOOK_SELECT = `
  SELECT b.id, b.owner_id, b.title, b.author, b.category, b.mode, b.condition, b.isbn,
         b.description, b.status, b.holder_id, b.due_date, b.created_at,
         ${userCols("o", "owner")}, ${userCols("h", "holder")}
    FROM books b
    JOIN users o ON o.user_id = b.owner_id
    LEFT JOIN users h ON h.user_id = b.holder_id`;

// SELECT base de pedidos com livro, livro oferecido, solicitante e dono.
export const REQUEST_SELECT = `
  SELECT r.id, r.type, r.status, r.message, r.due_date, r.created_at, r.decided_at, r.returned_at,
         r.book_id, r.offered_book_id, r.requester_id, r.owner_id,
         b.title AS book_title, b.author AS book_author, b.status AS book_status,
         ob.id AS offered_id, ob.title AS offered_title, ob.author AS offered_author,
         ${userCols("rq", "requester")}, ${userCols("ow", "owner")}
    FROM requests r
    JOIN books b ON b.id = r.book_id
    LEFT JOIN books ob ON ob.id = r.offered_book_id
    JOIN users rq ON rq.user_id = r.requester_id
    JOIN users ow ON ow.user_id = r.owner_id`;

export function userPublic(row, prefix) {
  if (!row || row[`${prefix}_user_id`] == null) return null;
  return {
    user_id: row[`${prefix}_user_id`],
    username: row[`${prefix}_username`],
    display_name: row[`${prefix}_display_name`] ?? null,
    avatar_url: row[`${prefix}_avatar_url`],
  };
}

export function toUserPublic(u) {
  if (!u) return null;
  return { user_id: u.user_id, username: u.username, display_name: u.display_name ?? null, avatar_url: u.avatar_url };
}

export function toBook(row, me) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    mode: row.mode,
    condition: row.condition,
    isbn: row.isbn ?? null,
    description: row.description ?? null,
    status: row.status,
    due_date: row.due_date ?? null,
    owner: userPublic(row, "owner"),
    holder: row.holder_id ? userPublic(row, "holder") : null,
    created_at: row.created_at,
    is_mine: Boolean(me && me.user_id === row.owner_id),
  };
}

export function toRequest(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    message: row.message ?? null,
    due_date: row.due_date ?? null,
    created_at: row.created_at,
    decided_at: row.decided_at ?? null,
    returned_at: row.returned_at ?? null,
    book: { id: row.book_id, title: row.book_title, author: row.book_author, status: row.book_status },
    offered_book: row.offered_id != null ? { id: row.offered_id, title: row.offered_title, author: row.offered_author } : null,
    requester: userPublic(row, "requester"),
    owner: userPublic(row, "owner"),
  };
}

export async function loadBook(env, id, me) {
  const row = await env.DB.prepare(`${BOOK_SELECT} WHERE b.id = ?`).bind(id).first();
  return row ? toBook(row, me) : null;
}

export async function loadRequest(env, id) {
  const row = await env.DB.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).bind(id).first();
  return row ? toRequest(row) : null;
}
