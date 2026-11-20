export function json(dados, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cabecalhos,
    },
  });
}

export function erro(mensagem, status = 400) {
  return json({ erro: mensagem }, status);
}

export function lerCookie(request, nome) {
  const bruto = request.headers.get("cookie") || "";
  for (const parte of bruto.split(";")) {
    const indice = parte.indexOf("=");
    if (indice === -1) continue;
    if (parte.slice(0, indice).trim() === nome) {
      return parte.slice(indice + 1).trim();
    }
  }
  return null;
}

export function redirecionar(destino, cookies = []) {
  const cabecalhos = new Headers({ Location: destino, "Cache-Control": "no-store" });
  for (const cookie of cookies) cabecalhos.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers: cabecalhos });
}

export async function lerCorpoJson(request) {
  try {
    const dados = await request.json();
    return dados && typeof dados === "object" ? dados : null;
  } catch {
    return null;
  }
}
