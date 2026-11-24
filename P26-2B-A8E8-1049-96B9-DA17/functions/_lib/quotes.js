/** Validação e serialização de citações. */
export const LIMITS = { text: 2000, author: 200, work: 300, reflection: 3000 };
export const MAX_TAGS = 8;
export const MAX_TAG_LEN = 30;
const TAG_RE = /^[\p{L}\p{N}_-]+$/u;

/** Normaliza uma tag: tira '#', espaços e caixa. Retorna a tag ou null se inválida. */
export function normalizeTag(v) {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/^#+/, "").toLowerCase();
  return t.length >= 1 && t.length <= MAX_TAG_LEN && TAG_RE.test(t) ? t : null;
}

/** Normaliza texto para comparar duplicatas (caixa, acentos e espaços). */
export function normalizeForDup(v) {
  return String(v ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
export const dupKey = (text, author) => `${normalizeForDup(text)}\u0000${normalizeForDup(author)}`;

export function validateQuote(body) {
  const fields = {};
  const str = (k) => (body[k] === undefined || body[k] === null ? "" : body[k]);
  const clean = {};

  for (const k of ["text", "author", "work", "reflection"]) {
    const v = str(k);
    if (typeof v !== "string") { fields[k] = "Deve ser um texto."; continue; }
    clean[k] = v.trim();
    if (clean[k].length > LIMITS[k]) fields[k] = `Máximo de ${LIMITS[k]} caracteres.`;
  }
  if (!fields.text && !clean.text) fields.text = "O trecho é obrigatório.";
  if (!fields.author && !clean.author) fields.author = "O autor é obrigatório.";

  let page = null;
  const rp = body.page;
  if (rp !== undefined && rp !== null && rp !== "") {
    const n = typeof rp === "number" ? rp : typeof rp === "string" && /^\d{1,6}$/.test(rp.trim()) ? Number(rp.trim()) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > 999999) fields.page = "A página deve ser um inteiro maior ou igual a 0.";
    else page = n;
  }

  let visibility = null; // null = omitido
  if (body.visibility !== undefined && body.visibility !== null && body.visibility !== "") {
    if (body.visibility === "public" || body.visibility === "private") visibility = body.visibility;
    else fields.visibility = "Use 'public' ou 'private'.";
  }

  // tags: omitido => null (PUT mantém as atuais; POST usa []).
  let tags = null;
  if (body.tags !== undefined && body.tags !== null) {
    if (!Array.isArray(body.tags)) fields.tags = "Deve ser uma lista de tags.";
    else {
      const set = new Set();
      for (const raw of body.tags) {
        const t = normalizeTag(raw);
        if (t === null) {
          fields.tags = `Cada tag deve ter de 1 a ${MAX_TAG_LEN} caracteres, só letras, números, _ ou -.`;
          break;
        }
        set.add(t);
      }
      if (!fields.tags && set.size > MAX_TAGS) fields.tags = `Máximo de ${MAX_TAGS} tags por citação.`;
      if (!fields.tags) tags = [...set];
    }
  }

  if (Object.keys(fields).length) return { fields };
  return {
    value: {
      text: clean.text, author: clean.author,
      work: clean.work || null, reflection: clean.reflection || null,
      page, tags, isPublic: visibility === null ? null : visibility === "public" ? 1 : 0, // null = omitido
    },
  };
}

const splitCsv = (v) => (typeof v === "string" && v ? v.split(",") : []);

/** Linha (JOIN com discord_users) -> objeto do contrato. collectionIds só vai ao dono (viewerId). */
export function toQuote(r, viewerId = null) {
  return {
    id: r.id, text: r.text, author: r.author, work: r.work ?? null, page: r.page ?? null,
    reflection: r.reflection ?? null, visibility: r.is_public === 1 ? "public" : "private",
    tags: splitCsv(r.tags_csv).sort(),
    collectionIds: viewerId !== null && r.user_id === viewerId ? splitCsv(r.coll_csv).map(Number).sort((a, b) => a - b) : [],
    createdAt: r.created_at ?? null, updatedAt: r.updated_at ?? null,
    owner: { userId: r.user_id, username: r.owner_username ?? "", avatar: r.owner_avatar ?? null },
  };
}

export const SELECT_QUOTE =
  "SELECT q.id, q.user_id, q.text, q.author, q.work, q.page, q.reflection, q.is_public, q.created_at, q.updated_at, " +
  "(SELECT group_concat(t.tag, ',') FROM quote_tags t WHERE t.quote_id = q.id) AS tags_csv, " +
  "(SELECT group_concat(cq.collection_id, ',') FROM collection_quotes cq WHERE cq.quote_id = q.id) AS coll_csv, " +
  "u.username AS owner_username, u.avatar AS owner_avatar " +
  "FROM quotes q JOIN discord_users u ON u.user_id = q.user_id";

export function parseLimit(v) {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 50);
}

/** cursor: inteiro positivo ou null; "invalid" se mal formado. */
export function parseCursor(v) {
  if (v === null || v === undefined || v === "") return null;
  return /^\d{1,15}$/.test(v) && Number(v) > 0 ? Number(v) : "invalid";
}

export function parseId(v) {
  return /^\d{1,15}$/.test(String(v)) && Number(v) > 0 ? Number(v) : null;
}

/** Instruções (para db.batch) que gravam as tags de uma citação. */
export function tagStatements(db, quoteId, tags) {
  return tags.map((t) => db.prepare("INSERT OR IGNORE INTO quote_tags (quote_id, tag) VALUES (?, ?)").bind(quoteId, t));
}

/** Divide em blocos (D1 limita ~100 parâmetros por consulta). */
export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
