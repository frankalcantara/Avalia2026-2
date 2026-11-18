export async function onRequestGet(context) {
    const filmeId = new URL(context.request.url).searchParams.get('filme_id');
    if (!filmeId) return Response.json({ error: 'filme_id obrigatório' }, { status: 400 });

    const db = context.env.catalogo_filmes;
    const { results } = await db.prepare(
        'SELECT user_id, rating, review_text, updated_at FROM reviews WHERE filme_id = ? ORDER BY updated_at DESC'
    ).bind(filmeId).all();

    return Response.json(results);
}

export async function onRequestPost(context) {
    const cookieHeader = context.request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/user_session=([^;]+)/);
    if (!match) return Response.json({ error: 'Login obrigatório' }, { status: 401 });

    let user;
    try {
        user = JSON.parse(decodeURIComponent(atob(match[1])));
    } catch {
        return Response.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const { filme_id, rating, review_text } = await context.request.json();
    const nota = Number(rating);
    if (!filme_id || isNaN(nota) || nota < 1 || nota > 5) {
        return Response.json({ error: 'Nota inválida (1 a 5)' }, { status: 400 });
    }

    const db = context.env.catalogo_filmes;
    await db.prepare(`
        INSERT INTO reviews (user_id, filme_id, rating, review_text, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, filme_id) DO UPDATE SET
            rating = excluded.rating,
            review_text = excluded.review_text,
            updated_at = CURRENT_TIMESTAMP
    `).bind(user.id, filme_id, nota, review_text || '').run();

    return Response.json({ success: true });
}