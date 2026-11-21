/**
 * Funções compartilhadas pelas Cloudflare Pages Functions.
 * Toda regra de negócio é validada aqui no servidor: o navegador nunca é confiável.
 */

export const CHAVE = "P26-2A-52D1-7EC2-3200-758A";
const COOKIE_SESSAO = "sessao";
const DURACAO_SESSAO_SEG = 60 * 60 * 24 * 7; // 7 dias

/** Resposta JSON padronizada. */
export function json(dados, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cabecalhos },
  });
}

/** Resposta de erro padronizada. */
export function erro(mensagem, status = 400) {
  return json({ ok: false, erro: mensagem }, status);
}

/** Lê um cookie pelo nome. */
export function lerCookie(request, nome) {
  const cabecalho = request.headers.get("Cookie") || "";
  for (const parte of cabecalho.split(";")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave === nome) return decodeURIComponent(resto.join("="));
  }
  return null;
}

/** Monta um cookie seguro (HttpOnly, Secure, SameSite=Lax). */
export function montarCookie(nome, valor, maxAgeSeg) {
  return `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeg}`;
}

/** Gera um token aleatório criptograficamente seguro (hex). */
export function tokenAleatorio(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cria uma sessão no D1 para o usuário e devolve o cabeçalho Set-Cookie. */
export async function criarSessao(env, userId) {
  const token = tokenAleatorio();
  const expira = new Date(Date.now() + DURACAO_SESSAO_SEG * 1000).toISOString();
  await env.DB.prepare("DELETE FROM sessoes WHERE expira_em < ?").bind(new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO sessoes (token, user_id, expira_em) VALUES (?, ?, ?)").bind(token, userId, expira).run();
  return montarCookie(COOKIE_SESSAO, token, DURACAO_SESSAO_SEG);
}

/** Apaga a sessão atual e devolve o cabeçalho Set-Cookie que limpa o cookie. */
export async function encerrarSessao(env, request) {
  const token = lerCookie(request, COOKIE_SESSAO);
  if (token) await env.DB.prepare("DELETE FROM sessoes WHERE token = ?").bind(token).run();
  return montarCookie(COOKIE_SESSAO, "", 0);
}

/** Devolve o usuário logado ({ user_id, username, avatar }) ou null. */
export async function usuarioAtual(env, request) {
  const token = lerCookie(request, COOKIE_SESSAO);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return await env.DB.prepare(
    `SELECT u.user_id, u.username, u.avatar
       FROM sessoes s JOIN discord_users u ON u.user_id = s.user_id
      WHERE s.token = ? AND s.expira_em > ?`
  ).bind(token, new Date().toISOString()).first();
}

/** Lê o corpo JSON com segurança (devolve {} se inválido). */
export async function lerJson(request) {
  try {
    const dados = await request.json();
    return dados && typeof dados === "object" ? dados : {};
  } catch {
    return {};
  }
}

/** Remove espaços extras e caracteres de controle de um texto vindo do usuário. */
export function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Converte o id da URL para inteiro positivo, ou null. */
export function idValido(valor) {
  return /^\d{1,9}$/.test(String(valor)) && Number(valor) > 0 ? Number(valor) : null;
}
