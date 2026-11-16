import { HttpError, json, readJson, stringField, enumField, assertKeys } from './http.js';
import { requireUser } from './auth.js';

export const bookSelect = `SELECT b.id,b.owner_id,b.title,b.author,b.category,b.condition,b.description,b.mode,b.status,b.created_at,
  u.display_name AS owner_name,u.username AS owner_username
  FROM books b JOIN users u ON u.user_id=b.owner_id`;

export function getBook(db, id) {
  return db.prepare(`${bookSelect} WHERE b.id=? AND b.deleted_at IS NULL`).bind(id).first();
}

const fields = ['title','author','category','condition','description','mode'];
function bookData(body) {
  assertKeys(body, fields);
  return {
    title: stringField(body.title, 'Título', 200),
    author: stringField(body.author, 'Autor', 200),
    category: enumField(body.category, ['tecnico','literario'], 'Categoria'),
    condition: enumField(body.condition, ['novo','bom','marcas'], 'Estado de conservação'),
    description: stringField(body.description, 'Descrição', 1200, false),
    mode: enumField(body.mode, ['emprestimo','troca','ambos'], 'Modalidade'),
  };
}

export async function listBooks(request, env) {
  const search = new URL(request.url).searchParams;
  const clauses = ['b.deleted_at IS NULL'];
  const values = [];
  const q = stringField(search.get('q') ?? '', 'Busca', 200, false);
  if (q) {
    // LIKE literal: % e _ digitados pelo usuário não ampliam a busca.
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push("(b.title LIKE ? ESCAPE '\\' OR b.author LIKE ? ESCAPE '\\')");
    values.push(pattern, pattern);
  }
  for (const [key, allowed] of [
    ['category',['tecnico','literario']], ['status',['disponivel','reservado','emprestado']],
    ['mode',['emprestimo','troca','ambos']],
  ]) {
    const value = search.get(key);
    if (!value) continue;
    enumField(value, allowed, key);
    if (key === 'mode' && value !== 'ambos') clauses.push("(b.mode=? OR b.mode='ambos')");
    else clauses.push(`b.${key}=?`);
    values.push(value);
  }
  const { results } = await env.DB.prepare(`${bookSelect} WHERE ${clauses.join(' AND ')} ORDER BY b.created_at DESC,b.id DESC`).bind(...values).all();
  return json({ books: results });
}

export async function createBook(request, env) {
  const user = await requireUser(request, env);
  const data = bookData(await readJson(request));
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO books(id,owner_id,title,author,category,condition,description,mode) VALUES(?,?,?,?,?,?,?,?)')
    .bind(id,user.user_id,data.title,data.author,data.category,data.condition,data.description,data.mode).run();
  return json({ book: await getBook(env.DB,id) }, 201);
}

export async function changeBook(request, env, id) {
  const user = await requireUser(request, env);
  const book = await getBook(env.DB,id);
  if (!book) throw new HttpError(404, 'Livro não encontrado.');
  if (book.owner_id !== user.user_id) throw new HttpError(403, 'Somente o proprietário pode alterar este livro.');
  if (book.status !== 'disponivel') throw new HttpError(409, 'Este livro está reservado ou emprestado.');
  const body = await readJson(request);
  let result;
  if (request.method === 'DELETE') {
    assertKeys(body, []);
    result = await env.DB.prepare("UPDATE books SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND status='disponivel' AND deleted_at IS NULL")
      .bind(id,user.user_id).run();
  } else {
    assertKeys(body, fields);
    if (!Object.keys(body).length) throw new HttpError(400, 'Informe ao menos um campo para editar.');
    const data = bookData({ ...Object.fromEntries(fields.map(key => [key,book[key]])), ...body });
    result = await env.DB.prepare("UPDATE books SET title=?,author=?,category=?,condition=?,description=?,mode=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND status='disponivel' AND deleted_at IS NULL")
      .bind(data.title,data.author,data.category,data.condition,data.description,data.mode,id,user.user_id).run();
  }
  if (result.meta.changes !== 1) throw new HttpError(409, 'O livro mudou enquanto você editava. Atualize a página.');
  return request.method === 'DELETE' ? json({ok:true}) : json({book:await getBook(env.DB,id)});
}
