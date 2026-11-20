// Utilitários HTTP compartilhados (somente APIs web: Request, Response, crypto).
// Chave de auditoria: P26-2C-DC19-34DD-D6E4-3F3F

export function json(dados, status = 200, headers = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export function erro(status, mensagem, field, headers = {}) {
  const corpo = { error: mensagem };
  if (field) corpo.field = field;
  return json(corpo, status, headers);
}

// Registra o erro real no log e devolve 500 genérico (sem vazar detalhes).
export function erroInterno(e) {
  console.error("Erro interno:", e);
  return erro(500, "Erro interno do servidor.");
}

export function parseCookies(request) {
  const saida = {};
  const cabecalho = request.headers.get("Cookie");
  if (!cabecalho) return saida;
  for (const parte of cabecalho.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const nome = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (!nome || nome in saida) continue;
    try {
      saida[nome] = decodeURIComponent(valor);
    } catch {
      saida[nome] = valor;
    }
  }
  return saida;
}

export function serializeCookie(nome, valor, op = {}) {
  let s = `${nome}=${encodeURIComponent(valor)}`;
  if (op.maxAge !== undefined) s += `; Max-Age=${Math.floor(op.maxAge)}`;
  s += `; Path=${op.path || "/"}`;
  if (op.httpOnly !== false) s += "; HttpOnly";
  if (op.secure) s += "; Secure";
  s += `; SameSite=${op.sameSite || "Lax"}`;
  return s;
}

export function ehHttps(request) {
  return new URL(request.url).protocol === "https:";
}

// Lê o corpo JSON. Devolve { data } ou { erro: Response }.
// Content-Type diferente de application/json: 403 (contrato); JSON inválido ou não-objeto: 400.
export async function lerJson(request) {
  const tipo = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    return { erro: erro(403, "Content-Type deve ser application/json.") };
  }
  let data;
  try {
    data = JSON.parse(await request.text());
  } catch {
    return { erro: erro(400, "JSON inválido.") };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { erro: erro(400, "O corpo deve ser um objeto JSON.") };
  }
  return { data };
}

// Proteção CSRF: Origin deve ser idêntico (esquema, host e porta) ao da requisição.
// Origin ausente é rejeitado, salvo permitirAusente (usado só no logout).
export function mesmaOrigem(request, permitirAusente = false) {
  const origin = request.headers.get("Origin");
  if (!origin) return permitirAusente;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

// Comparação em tempo constante de duas strings.
export function igualConstante(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

export function autorJson(id, username, avatar_url) {
  return { id, username, avatar_url };
}

export function bytesHex(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
