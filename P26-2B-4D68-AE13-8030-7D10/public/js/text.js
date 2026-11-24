export const FALLBACK_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

export function formatDate(value) {
  if (!value) return "Agora";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export function excerpt(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[`*_#>[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 250);
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

// Sumário do artigo: só títulos de nível 2 e 3, iguais aos que o renderizador gera.
export function extractHeadings(markdown) {
  const headings = [];
  const seen = new Map();
  let inCode = false;
  for (const line of String(markdown || "").split(/\r?\n/)) {
    // Títulos dentro de bloco de código não existem no HTML renderizado.
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match) continue;
    const text = match[2].replace(/[*_`]/g, "").trim();
    if (!text) continue;
    const base = slugify(text);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    headings.push({ level: match[1].length, text, id: count ? `${base}-${count}` : base });
  }
  return headings;
}

export function splitTags(value) {
  return value ? String(value).split(",").filter(Boolean) : [];
}

export function readingTime(markdown) {
  const words = String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.max(1, Math.round(words / 200));
}
