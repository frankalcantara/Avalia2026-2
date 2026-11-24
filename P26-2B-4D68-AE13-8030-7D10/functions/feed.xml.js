import { excerpt } from "../public/js/text.js";

const escapeXml = (value) => String(value ?? "").replace(/[<>&'"]/g, (char) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
})[char]);

// Feed RSS 2.0: só artigos visíveis para quem não está logado.
export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const empty = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Entrelinhas — Blog técnico da turma</title>
  <link>${escapeXml(origin)}/</link>
  <description>Artigos, descobertas e experiências técnicas da turma 2B.</description>
</channel></rss>`;

  if (!env.DB) {
    return new Response(empty, { status: 503, headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
  }

  const result = await env.DB.prepare(`
    SELECT a.slug, a.title, a.body, a.created_at, u.username AS author_name
    FROM articles a
    JOIN discord_users u ON u.user_id = a.author_id
    LEFT JOIN rooms r ON r.id = a.room_id
    WHERE a.room_id IS NULL OR r.visibility = 'public'
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 20
  `).all();

  const items = (result.results || []).map((article) => {
    const link = `${origin}/artigo/${article.slug}`;
    return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <dc:creator>${escapeXml(article.author_name)}</dc:creator>
      <pubDate>${new Date(`${String(article.created_at).replace(" ", "T")}Z`).toUTCString()}</pubDate>
      <description>${escapeXml(excerpt(article.body))}</description>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
  <title>Entrelinhas — Blog técnico da turma</title>
  <link>${escapeXml(origin)}/</link>
  <description>Artigos, descobertas e experiências técnicas da turma 2B.</description>
  <language>pt-BR</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
