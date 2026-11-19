// GET /api/products — catálogo público com filtros opcionais.
import { json, error } from "../_lib/http.js";

const SORTS = {
  name: "name COLLATE NOCASE ASC, id ASC",
  price_asc: "price ASC, name COLLATE NOCASE ASC",
  price_desc: "price DESC, name COLLATE NOCASE ASC",
};

// Inteiro >= 0 a partir da query; undefined se ausente; NaN se inválido.
function parsePrice(v) {
  if (v === null || v === "") return undefined;
  return /^\d{1,9}$/.test(v) ? Number(v) : NaN;
}

const invalid = (msg) => error(400, "invalid_filter", msg);

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") || "").trim();
  const category = (p.get("category") || "").trim();
  const min = parsePrice(p.get("min"));
  const max = parsePrice(p.get("max"));
  const sort = p.get("sort") || "name";

  if (Number.isNaN(min)) return invalid("Filtro 'min' deve ser um inteiro não negativo.");
  if (Number.isNaN(max)) return invalid("Filtro 'max' deve ser um inteiro não negativo.");
  if (min !== undefined && max !== undefined && min > max) return invalid("'min' não pode ser maior que 'max'.");
  if (!SORTS[sort]) return invalid("Ordenação inválida. Use price_asc, price_desc ou name.");
  if (q.length > 100 || category.length > 100) return invalid("Filtro de texto muito longo.");

  // Filtros montados com placeholders; valores sempre via bind.
  const where = [];
  const args = [];
  if (q) {
    const like = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    where.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
    args.push(like, like);
  }
  if (category) { where.push("category = ?"); args.push(category); }
  if (min !== undefined) { where.push("price >= ?"); args.push(min); }
  if (max !== undefined) { where.push("price <= ?"); args.push(max); }

  const sql =
    "SELECT id, sku, name, description, category, price, stock, icon FROM products" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY " + SORTS[sort];

  // Categorias e faixa de preço do catálogo inteiro.
  const [list, cats, range] = await env.DB.batch([
    env.DB.prepare(sql).bind(...args),
    env.DB.prepare("SELECT DISTINCT category FROM products ORDER BY category"),
    env.DB.prepare("SELECT MIN(price) AS min, MAX(price) AS max FROM products"),
  ]);

  const r = range.results?.[0] || {};
  return json({
    ok: true,
    products: list.results || [],
    categories: (cats.results || []).map((c) => c.category),
    priceRange: { min: r.min ?? 0, max: r.max ?? 0 },
  });
}
