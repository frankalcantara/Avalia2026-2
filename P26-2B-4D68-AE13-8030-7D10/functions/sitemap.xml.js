const escapeXml = (value) => String(value ?? "").replace(/[<>&'"]/g, (char) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
})[char]);

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  let urls = [`  <url><loc>${escapeXml(origin)}/</loc><changefreq>daily</changefreq></url>`];

  if (env.DB) {
    const result = await env.DB.prepare(`
      SELECT a.slug, a.updated_at
      FROM articles a
      LEFT JOIN rooms r ON r.id = a.room_id
      WHERE a.room_id IS NULL OR r.visibility = 'public'
      ORDER BY a.created_at DESC
      LIMIT 500
    `).all();
    urls = urls.concat((result.results || []).map((article) => {
      const lastmod = article.updated_at ? String(article.updated_at).slice(0, 10) : "";
      const stamp = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
      return `  <url><loc>${escapeXml(`${origin}/artigo/${article.slug}`)}</loc>${stamp}</url>`;
    }));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
