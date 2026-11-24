/**
 * GET /d/:id
 * Página pública do link de desafio com meta tags Open Graph (prévia no Discord/LinkedIn).
 * Não revela a palavra; redireciona para o jogo.
 */
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function onRequestGet({ env, params }) {
  const id = String(params.id || "");
  const valid = /^[A-Za-z0-9]{10}$/.test(id);
  let creator = null;
  if (valid) {
    const row = await env.DB.prepare(
      "SELECT u.username FROM challenges c JOIN users u ON u.user_id = c.creator_id WHERE c.id = ?"
    ).bind(id).first();
    creator = row ? row.username : null;
  }
  const title = escapeHtml(creator ? `${creator} te desafiou a abrir um cofre no Cypher` : "Você foi desafiado a abrir um cofre no Cypher");
  const description = "Uma palavra secreta de 5 letras. Seis tentativas. Você consegue abrir?";
  const target = valid ? `/?desafio=${id}` : "/";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cypher">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="/og-desafio.png">
<meta property="og:url" content="/d/${valid ? id : ""}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="/og-desafio.png">
<meta name="theme-color" content="#14161c">
<meta http-equiv="refresh" content="0;url=${target}">
</head>
<body>
<p><a href="${target}">Abrir o desafio no Cypher</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
