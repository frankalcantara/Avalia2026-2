export const API = {
  session: "/api/auth/session",
  logout: "/api/auth/logout",
  categories: "/api/quiz/categories",
  start: "/api/quiz/start",
  answer: "/api/quiz/answer",
  next: "/api/quiz/next",
};

export async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.message || data.error || "Não foi possível concluir a solicitação.",
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
