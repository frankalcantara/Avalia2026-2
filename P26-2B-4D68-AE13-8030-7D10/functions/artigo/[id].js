import { ARTICLE_FIELDS, SLUG_PATTERN, canViewArticle, findArticleBySlug } from "../_lib/articles.js";
import { getSession } from "../_lib/session.js";
import { renderMarkdown } from "../../public/js/markdown.js";
import {
  FALLBACK_AVATAR, excerpt, extractHeadings, formatDate, readingTime, splitTags,
} from "../../public/js/text.js";

const CHAVE_UNICA = "P26-2B-4D68-AE13-8030-7D10";

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const avatar = (src) =>
  `<img class="avatar" src="${escapeHtml(src || FALLBACK_AVATAR)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;

function renderPage({ title, description, user, content, robots = "index, follow", canonical = "", status = 200 }) {
  const account = user
    ? `<div class="profile-chip" title="${escapeHtml(user.username)}">${avatar(user.avatar)}<span class="profile-name">Olá, ${escapeHtml(user.username)}</span></div>`
    : `<a class="button button-discord" href="/api/auth/discord">Entrar com Discord</a>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="alternate" type="application/rss+xml" title="Entrelinhas" href="/feed.xml">
  <meta property="og:site_name" content="Entrelinhas">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  ${robots.includes("noindex") ? '<meta name="robots" content="noindex, nofollow">' : ""}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
  <header class="topbar">
    <a class="brand" href="/" aria-label="Entrelinhas, página inicial">
      <span class="brand-mark" aria-hidden="true">E</span>
      <span>entrelinhas<span class="brand-dot">.</span><small>blog técnico da turma</small></span>
    </a>
    <div class="top-actions">${account}</div>
  </header>

  <main class="article-page" id="conteudo">
    <a class="back-link" href="/"><span aria-hidden="true">←</span> Voltar para o feed</a>
    ${content}
  </main>

  <footer>
    <a class="brand footer-brand" href="/"><span class="brand-mark" aria-hidden="true">E</span><span>entrelinhas<span class="brand-dot">.</span></span></a>
    <span>Turma 2B · Chave Única <code>${CHAVE_UNICA}</code> · Licença MIT</span>
  </footer>
  ${user ? `<script type="module" src="/js/artigo.js"></script>` : ""}
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": robots,
    },
  });
}

function renderNotice({ status, title, message, user, canonical }) {
  return renderPage({
    title,
    description: message,
    user,
    canonical,
    robots: "noindex, nofollow",
    status,
    content: `<p class="empty-state">${escapeHtml(message)}</p>`,
  });
}

function renderComment(comment, permissions) {
  const actions = [
    permissions.canDelete
      ? `<button class="action-button action-danger" type="button" data-delete-comment="${comment.id}" aria-label="Excluir comentário de ${escapeHtml(comment.username)}">Excluir comentário</button>`
      : "",
    permissions.canReport
      ? `<button class="action-button" type="button" data-report-comment="${comment.id}" aria-label="Denunciar comentário de ${escapeHtml(comment.username)}">Denunciar</button>`
      : "",
  ].join("");

  return `<div class="comment-item" data-comment="${comment.id}">
      ${avatar(comment.avatar)}
      <div>
        <div><span class="comment-author">${escapeHtml(comment.username)}</span> <time class="comment-date" datetime="${escapeHtml(comment.created_at || "")}">${escapeHtml(formatDate(comment.created_at))}</time></div>
        <p class="comment-body">${escapeHtml(comment.body)}</p>
        <div class="comment-actions">${actions}</div>
      </div>
    </div>`;
}

function renderToc(headings) {
  if (headings.length < 3) return "";
  const items = headings
    .map((heading) => `<li class="toc-level-${heading.level}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`)
    .join("");
  return `<nav class="article-toc" aria-labelledby="tocHeading">
      <h2 class="toc-title" id="tocHeading">Neste artigo</h2>
      <ol>${items}</ol>
    </nav>`;
}

function renderTags(tags) {
  if (!tags.length) return "";
  const chips = tags
    .map((tag) => `<a class="tag-chip" href="/?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`)
    .join("");
  return `<p class="article-tags">${chips}</p>`;
}

function renderRelated(related) {
  if (!related.length) return "";
  const items = related.map((item) => `<li><a href="/artigo/${escapeHtml(item.slug)}">${escapeHtml(item.title)}</a> <span class="muted">· ${escapeHtml(item.author_name)}</span></li>`).join("");
  return `<section class="related" aria-labelledby="relatedHeading">
      <h2 id="relatedHeading">Continue lendo</h2>
      <ul>${items}</ul>
    </section>`;
}

function renderArticle({ article, comments, related, user, permissions }) {
  const isPrivate = article.room_visibility === "private";
  const roomLabel = article.room_name ? (isPrivate ? "Sala privada" : article.room_name) : "";
  const roomTag = roomLabel
    ? `<span class="meta-dot" aria-hidden="true">·</span><span class="room-tag${isPrivate ? " private" : ""}">${escapeHtml(roomLabel)}</span>`
    : "";
  const tags = splitTags(article.tags);
  const headings = extractHeadings(article.body);
  const updated = article.updated_at && article.updated_at !== article.created_at
    ? ` · atualizado em ${escapeHtml(formatDate(article.updated_at))}`
    : "";

  const ownerActions = user && user.userId === article.author_id
    ? `<div class="article-actions owner-bar">
        <a class="button button-small button-accent" href="/?editar=${article.id}" title="Abre o artigo no editor da página inicial">Editar artigo</a>
        <a class="button button-small" href="/?author=${encodeURIComponent(article.author_id)}">Ver meus artigos</a>
        <button class="button button-small button-danger" type="button" data-delete-article="${article.id}" title="Apaga o artigo e os comentários dele">Excluir artigo</button>
      </div>`
    : "";

  const commentsList = comments.length
    ? comments.map((comment) => renderComment(comment, permissions(comment))).join("\n")
    : `<p class="muted">Ainda não há comentários. Comece a conversa.</p>`;

  const composer = user
    ? `<form class="comment-form" data-article-id="${article.id}">
          <input class="text-input" maxlength="3000" required placeholder="Escreva um comentário..." aria-label="Escreva um comentário">
          <button class="button button-primary button-small" type="submit">Comentar</button>
        </form>`
    : `<a class="text-link" href="/api/auth/discord">Entre com Discord para comentar</a>`;

  return `<article>
      <div class="article-meta">
        <a class="author-button" href="/?author=${encodeURIComponent(article.author_id)}">
          ${avatar(article.author_avatar)}
          <span>${escapeHtml(article.author_name)}</span>
        </a>
        <span class="meta-dot" aria-hidden="true">·</span>
        <time datetime="${escapeHtml(article.created_at || "")}">${escapeHtml(formatDate(article.created_at))}</time>
        <span class="meta-dot" aria-hidden="true">·</span>
        <span>${readingTime(article.body)} min de leitura</span>
        ${updated}
        ${roomTag}
      </div>
      <h1 class="article-page-title">${escapeHtml(article.title)}</h1>
      ${renderTags(tags)}
      ${ownerActions}
      ${renderToc(headings)}
      <div class="markdown-body">${renderMarkdown(article.body)}</div>
      ${renderRelated(related)}
      <section class="comments-section" id="comments" aria-labelledby="commentsHeading">
        <h3 id="commentsHeading">Conversa</h3>
        ${composer}
        <div class="comments-list" id="commentsList">${commentsList}</div>
      </section>
    </article>`;
}

async function loadRelated(db, article, viewer, tags) {
  if (!tags.length) return [];
  const placeholders = tags.map(() => "?").join(", ");
  const result = await db.prepare(`
    SELECT a.slug, a.title, u.username AS author_name
    FROM articles a
    JOIN discord_users u ON u.user_id = a.author_id
    LEFT JOIN rooms r ON r.id = a.room_id
    WHERE a.id != ?
      AND EXISTS (SELECT 1 FROM article_tags t WHERE t.article_id = a.id AND t.tag IN (${placeholders}))
      AND (a.room_id IS NULL
        OR r.visibility = 'public'
        OR EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = a.room_id AND m.user_id = ?))
    ORDER BY a.created_at DESC
    LIMIT 3
  `).bind(article.id, ...tags, viewer).all();
  return result.results || [];
}

export async function onRequestGet({ request, env, params }) {
  const user = await getSession(request, env.SESSION_SECRET);
  const origin = new URL(request.url).origin;
  const canonical = `${origin}/artigo/${params.id}`;

  if (!env.DB) {
    return renderNotice({ status: 503, title: "Blog indisponível — Entrelinhas", message: "Banco de dados indisponível.", user, canonical });
  }
  const article = SLUG_PATTERN.test(params.id) ? await findArticleBySlug(env.DB, params.id) : null;
  if (!article) {
    return renderNotice({ status: 404, title: "Artigo não encontrado — Entrelinhas", message: "Artigo não encontrado.", user, canonical });
  }
  if (!await canViewArticle(env.DB, article, user?.userId)) {
    return renderNotice({ status: 404, title: "Artigo não encontrado — Entrelinhas", message: "Sala não encontrada.", user, canonical });
  }

  const row = await env.DB.prepare(`
    SELECT ${ARTICLE_FIELDS}
    FROM articles a
    JOIN discord_users u ON u.user_id = a.author_id
    LEFT JOIN rooms r ON r.id = a.room_id
    WHERE a.id = ?
  `).bind(user?.userId ?? null, article.id).first();

  const comments = await env.DB.prepare(`
    SELECT c.id, c.body, c.created_at, c.author_id, u.username, u.avatar
    FROM comments c JOIN discord_users u ON u.user_id = c.author_id
    WHERE c.article_id = ?
    ORDER BY c.created_at ASC, c.id ASC
    LIMIT 200
  `).bind(article.id).all();

  const roomOwner = article.room_id
    ? await env.DB.prepare("SELECT owner_id FROM rooms WHERE id = ?").bind(article.room_id).first()
    : null;

  const permissions = (comment) => ({
    canDelete: Boolean(user) && (
      comment.author_id === user.userId
      || row.author_id === user.userId
      || roomOwner?.owner_id === user.userId
    ),
    canReport: Boolean(user) && comment.author_id !== user.userId,
  });

  const related = await loadRelated(env.DB, article, user?.userId ?? "", splitTags(row.tags));

  return renderPage({
    title: `${row.title} — Entrelinhas`,
    description: excerpt(row.body),
    user,
    canonical,
    robots: row.room_visibility === "private" ? "noindex, nofollow" : "index, follow",
    content: renderArticle({ article: row, comments: comments.results || [], related, user, permissions }),
  });
}
