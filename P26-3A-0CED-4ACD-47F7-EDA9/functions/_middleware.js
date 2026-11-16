// Middleware global: erros em JSON, cabeçalhos de segurança e URLs absolutas no Open Graph
import { errorResponse } from "../src/http.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  let response;
  try {
    response = await context.next();
  } catch (err) {
    response = errorResponse(err);
  }

  response = new Response(response.body, response);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  if (url.pathname.startsWith("/api/")) response.headers.set("Cache-Control", "no-store");

  const type = response.headers.get("Content-Type") || "";
  if (!type.includes("text/html")) return response;

  // Redes sociais exigem og:image e og:url absolutas
  return new HTMLRewriter()
    .on('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:url"]', {
      element(el) {
        const content = el.getAttribute("content");
        if (content && content.startsWith("/") && !content.startsWith("//")) {
          el.setAttribute("content", url.origin + content);
        }
      },
    })
    .transform(response);
}
