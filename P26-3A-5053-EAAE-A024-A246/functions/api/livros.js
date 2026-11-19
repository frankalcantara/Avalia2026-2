import { getSessionUser, json } from "../_lib/session.js";

const CATEGORIAS = ["Técnico", "Literário"];
const MODALIDADES = ["Emprestar", "Trocar", "Ambos"];

export async function onRequestGet({ env }) {
  try {
    if (!env.DB) {
      return json({ ok: false, error: "Banco de dados indisponível." }, 503);
    }

    const result = await env.DB.prepare(`
      SELECT
        livros.id,
        livros.titulo,
        livros.autor,
        livros.categoria,
        livros.modalidade,
        livros.status,
        livros.dono_id,
        discord_users.username AS dono_username,
        discord_users.global_name AS dono_global_name
      FROM livros
      JOIN discord_users ON discord_users.user_id = livros.dono_id
      ORDER BY livros.id DESC
    `).all();

    return json({
      ok: true,
      livros: result.results || [],
    });
  } catch (error) {
    console.error("Erro ao consultar livros.");
    return json({ ok: false, error: "Não foi possível carregar os livros." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json(
        { ok: false, error: "Banco de dados indisponível." },
        503
      );
    }

    const user = await getSessionUser(request, env);

    if (!user) {
      return json(
        { ok: false, error: "Faça login com Discord para cadastrar livros." },
        401
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Dados enviados em formato inválido." }, 400);
    }

    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const autor = typeof body.autor === "string" ? body.autor.trim() : "";
    const categoria = body.categoria;
    const modalidade = body.modalidade;

    if (!titulo || !autor) {
      return json({ ok: false, error: "Preencha o título e o autor." }, 400);
    }

    if (titulo.length > 150 || autor.length > 120) {
      return json({ ok: false, error: "Título ou autor muito longo." }, 400);
    }

    if (!CATEGORIAS.includes(categoria)) {
      return json({ ok: false, error: "Categoria inválida." }, 400);
    }

    if (!MODALIDADES.includes(modalidade)) {
      return json({ ok: false, error: "Modalidade inválida." }, 400);
    }

    const result = await env.DB.prepare(`
      INSERT INTO livros (dono_id, titulo, autor, categoria, modalidade)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.user_id,
      titulo,
      autor,
      categoria,
      modalidade
    ).run();

    return json({
      ok: true,
      message: "Livro cadastrado com sucesso.",
      id: result.meta.last_row_id,
    }, 201);
  } catch (error) {
    console.error("Erro ao cadastrar livro.");
    return json({ ok: false, error: "Não foi possível cadastrar o livro." }, 500);
  }
}