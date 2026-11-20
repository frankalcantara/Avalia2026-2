function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const SVG_MAX_CHARS = 40000;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

// ---- HTML sanitizado -------------------------------------------------------
// Lista fechada de tags: o que não está aqui aparece como texto, nunca como marcação.
const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "caption", "code", "dd", "del", "details", "div", "dl", "dt",
  "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins",
  "li", "mark", "ol", "p", "pre", "s", "small", "span", "strong", "sub", "summary", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
  // Estrutura de página
  "address", "article", "aside", "footer", "header", "hgroup", "nav", "section", "time",
  // SVG
  "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "text",
  "tspan", "defs", "lineargradient", "radialgradient", "stop", "clippath", "symbol", "use",
  "title", "desc",
]);

const VOID_TAGS = new Set(["br", "hr", "img", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "stop", "use"]);

// <main> dentro da <main> da página não é válido: vira <div> e o conteúdo fica.
const TAG_ALIASES = { main: "div" };

// Blocos que nunca podem entrar, nem como texto: o conteúdo deles é descartado.
const DROPPED_BLOCKS = "script|style|iframe|object|embed|template|noscript|link|meta|base|form|input|button|textarea|select";

const ALLOWED_ATTRS = new Set([
  "title", "alt", "class", "role", "width", "height", "href", "src", "loading",
  "viewbox", "xmlns", "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "opacity", "fill-rule", "clip-rule", "cx", "cy", "r", "rx", "ry",
  "x", "y", "x1", "y1", "x2", "y2", "points", "transform", "text-anchor", "font-size",
  "font-family", "font-weight", "aria-label", "aria-hidden", "colspan", "rowspan", "datetime",
]);

const SAFE_URL = /^https?:\/\//i;

function safeUrl(value) {
  const url = String(value ?? "").trim();
  return SAFE_URL.test(url) ? url : "";
}

function filterAttributes(name, raw) {
  let output = "";
  const pattern = /([a-zA-Z][\w:-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (const match of String(raw || "").matchAll(pattern)) {
    const attr = match[1];
    const lower = attr.toLowerCase();
    if (!ALLOWED_ATTRS.has(lower)) continue; // descarta on*, style, id, data-*, formaction...
    const value = (match[3] ?? match[4] ?? match[5] ?? "").trim();
    if ((lower === "href" || lower === "src") && !safeUrl(value)) continue;
    // Mantém a grafia original: SVG diferencia viewBox de viewbox.
    output += value ? ` ${attr}="${escapeHtml(value)}"` : ` ${attr}`;
  }
  if (name === "a" && output.includes(" href=")) output += ' target="_blank" rel="noopener noreferrer"';
  return output;
}

// Documento HTML completo (colado inteiro) vira só o conteúdo do <body>: o
// <head> com <title>/<style> e a marcação html/head/body não entram no artigo.
function unwrapDocument(source) {
  const body = source.match(/<body\b[^>]*>([\s\S]*?)(?:<\/body\s*>|$)/i);
  const inner = body ? body[1] : source.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, "");
  return inner
    .replace(/<!doctype\b[^>]*>/gi, "")
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "");
}

// Remove blocos perigosos inteiros (inclusive o conteúdo) antes de validar as tags.
export function sanitizeHtml(html) {
  const source = unwrapDocument(String(html ?? ""))
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(new RegExp(`<\\s*(${DROPPED_BLOCKS})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*(${DROPPED_BLOCKS})\\b[^>]*>`, "gi"), "")
    .replace(new RegExp(`<\\s*\\/\\s*(${DROPPED_BLOCKS})\\s*>`, "gi"), "");

  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let output = "";
  let lastIndex = 0;
  for (const match of source.matchAll(tagPattern)) {
    output += source.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    const closing = match[1] === "/";
    const name = TAG_ALIASES[match[2].toLowerCase()] || match[2].toLowerCase();

    if (!ALLOWED_TAGS.has(name)) {
      // Tag desconhecida vira texto: o autor vê literalmente o que escreveu.
      output += escapeHtml(match[0]);
      continue;
    }
    if (closing) {
      if (!VOID_TAGS.has(name)) output += `</${name}>`;
      continue;
    }
    if (name === "img" && !/ src="https?:\/\//i.test(filterAttributes(name, match[3]))) {
      continue; // imagem sem URL http(s) segura simplesmente não aparece
    }
    output += `<${name}${filterAttributes(name, match[3])}>`;
  }
  return output + source.slice(lastIndex);
}

// Bloco ```svg vira <img> (data URL): dentro de <img> o navegador não executa script do SVG.
// Sem raiz <svg> ou grande demais, volta a ser bloco de código escapado.
function svgImage(source) {
  if (source.length > SVG_MAX_CHARS) return null;
  if (!/^\s*<svg[\s>]/i.test(source) || !/<\/svg>\s*$/i.test(source)) return null;

  const title = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const alt = title ? escapeHtml(title[1].trim().slice(0, 120)) : "Figura SVG";
  return `<img class="article-svg" src="data:image/svg+xml;base64,${toBase64(source)}" alt="${alt}" loading="lazy" decoding="async">`;
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "secao";
}

function safeLink(url) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function inlineMarkdown(text) {
  // `(?<!!)` evita que "![x](https://...)" vire um link solto com "!" na frente.
  const tokenPattern = /((?<!!)\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*.+?\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let html = "";
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      const href = link ? safeLink(link[2]) : null;
      html += href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link[1])}</a>`
        : escapeHtml(token);
    } else if (token.startsWith("**")) {
      html += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else if (token.startsWith("`")) {
      html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    } else {
      html += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    }
    lastIndex = match.index + token.length;
  }

  return html + escapeHtml(text.slice(lastIndex));
}

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function splitTableRow(line) {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map((cell) => cell.trim());
}

function alignClass(cell) {
  const value = cell.trim();
  if (value.startsWith(":") && value.endsWith(":")) return ' class="align-center"';
  if (value.endsWith(":")) return ' class="align-right"';
  return "";
}

function renderTable(headerCells, separatorCells, rows) {
  const head = headerCells
    .map((cell, index) => `<th${alignClass(separatorCells[index] || "")}>${inlineMarkdown(cell)}</th>`)
    .join("");
  const body = rows
    .map((cells) => `<tr>${headerCells
      .map((_, index) => `<td${alignClass(separatorCells[index] || "")}>${inlineMarkdown(cells[index] || "")}</td>`)
      .join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;
  const usedHeadingIds = new Map();

  const headingId = (text) => {
    const base = slugify(text);
    const seen = usedHeadingIds.get(base) || 0;
    usedHeadingIds.set(base, seen + 1);
    return seen ? `${base}-${seen}` : base;
  };

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("");
      blocks.push(`<${list.type}>${items}</${list.type}>`);
    }
    list = null;
  };
  const flushCode = () => {
    if (code === null) return;
    const source = code.lines.join("\n");
    if (code.language === "svg") blocks.push(svgImage(source) ?? `<pre><code>${escapeHtml(source)}</code></pre>`);
    else if (code.language === "html" || code.language === "htm") blocks.push(sanitizeHtml(source));
    else blocks.push(`<pre><code>${escapeHtml(source)}</code></pre>`);
    code = null;
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      if (code === null) code = { language: line.trim().slice(3).trim().toLowerCase(), lines: [] };
      else flushCode();
      index += 1;
      continue;
    }
    if (code !== null) {
      code.lines.push(line);
      index += 1;
      continue;
    }

    // Tabela: cabeçalho com "|" seguido da linha de separadores (---).
    const separator = lines[index + 1];
    if (line.includes("|") && separator !== undefined && separator.includes("|") && TABLE_SEPARATOR.test(separator)) {
      flushParagraph();
      flushList();
      const headerCells = splitTableRow(line);
      const separatorCells = splitTableRow(separator);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push(renderTable(headerCells, separatorCells, rows));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const id = headingId(heading[2]);
      blocks.push(`<h${level} id="${id}">${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
    } else if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push("<hr>");
    } else if (unordered || ordered) {
      flushParagraph();
      const type = ordered ? "ol" : "ul";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
    index += 1;
  }

  flushParagraph();
  flushList();
  flushCode();
  return blocks.join("\n");
}
