/**
 * Sessao assinada em cookie — P26-2B-273A-9914-8600-DE35
 *
 * Nao existe tabela de sessoes: o proprio cookie carrega o id do usuario no
 * Discord e a validade, com uma assinatura HMAC-SHA256 por cima. Quem nao tem
 * o SESSION_SECRET nao consegue forjar um cookie valido, e qualquer edicao no
 * conteudo invalida a assinatura.
 *
 * O cookie NAO e criptografado: qualquer um le o que esta dentro. Por isso so
 * entra ali o que pode ser publico — id do usuario e expiracao. Nada de nome,
 * e-mail ou token do Discord.
 */

const CODIFICADOR = new TextEncoder();
const NOME_COOKIE = "sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 7; // sete dias

function paraBase64Url(bytes) {
  let texto = "";
  for (const byte of new Uint8Array(bytes)) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto) {
  const normal = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, "="));
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function chaveHmac(segredo) {
  return crypto.subtle.importKey(
    "raw",
    CODIFICADOR.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function criarSessao(discordUserId, segredo) {
  const conteudo = paraBase64Url(
    CODIFICADOR.encode(
      JSON.stringify({
        uid: discordUserId,
        exp: Math.floor(Date.now() / 1000) + DURACAO_SEGUNDOS,
      })
    )
  );
  const assinatura = paraBase64Url(
    await crypto.subtle.sign("HMAC", await chaveHmac(segredo), CODIFICADOR.encode(conteudo))
  );
  return `${conteudo}.${assinatura}`;
}

export async function lerSessao(valor, segredo) {
  if (!valor || !valor.includes(".")) return null;
  const [conteudo, assinatura] = valor.split(".");

  // crypto.subtle.verify compara em tempo constante. Comparar assinatura com
  // === permitiria descobrir o valor correto byte a byte medindo o tempo de
  // resposta do servidor.
  const valida = await crypto.subtle
    .verify("HMAC", await chaveHmac(segredo), deBase64Url(assinatura), CODIFICADOR.encode(conteudo))
    .catch(() => false);
  if (!valida) return null;

  try {
    const dados = JSON.parse(new TextDecoder().decode(deBase64Url(conteudo)));
    if (!dados.uid || !dados.exp) return null;
    if (dados.exp < Math.floor(Date.now() / 1000)) return null;
    return String(dados.uid);
  } catch {
    return null;
  }
}

export function montarCookie(nome, valor, maxIdade, { seguro = true } = {}) {
  const partes = [
    `${nome}=${valor}`,
    "Path=/",
    "HttpOnly", // o JavaScript da pagina nao consegue ler
    "SameSite=Lax", // nao acompanha requisicao disparada por outro site
    `Max-Age=${maxIdade}`,
  ];
  // Secure exige HTTPS. Em producao e obrigatorio; no wrangler pages dev o
  // endereco e http://localhost, onde o navegador ainda aceita Secure por
  // considerar localhost origem confiavel — mas deixamos configuravel para
  // nao depender desse detalhe.
  if (seguro) partes.push("Secure");
  return partes.join("; ");
}

export function lerCookie(requisicao, nome) {
  const cabecalho = requisicao.headers.get("Cookie") || "";
  for (const parte of cabecalho.split(";")) {
    const corte = parte.indexOf("=");
    if (corte < 0) continue;
    if (parte.slice(0, corte).trim() === nome) return parte.slice(corte + 1).trim();
  }
  return null;
}

/**
 * Usado por TODO endpoint protegido. A identidade sai sempre daqui — nunca de
 * um campo que o cliente mandou no corpo ou na query.
 */
export async function usuarioDaRequisicao(requisicao, env) {
  return lerSessao(lerCookie(requisicao, NOME_COOKIE), env.SESSION_SECRET);
}

export { NOME_COOKIE, DURACAO_SEGUNDOS };
