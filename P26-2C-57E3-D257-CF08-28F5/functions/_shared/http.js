export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", ...headers },
  });
}

export async function readJson(request) {
  try {
    return { data: await request.json() };
  } catch {
    return { error: json({ error: "Corpo da solicitação inválido." }, 400) };
  }
}
