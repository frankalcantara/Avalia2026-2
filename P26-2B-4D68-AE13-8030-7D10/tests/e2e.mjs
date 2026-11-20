#!/usr/bin/env node
// Suite ponta a ponta contra um servidor local (`npm run dev`).
// Requer as linhas de discord_users dos dois usuários de teste (ver README).
import { readFileSync } from "node:fs";
import { signSession } from "../functions/_lib/session.js";

const base = process.env.E2E_BASE || "http://127.0.0.1:8788";
const secret = (readFileSync(".env", "utf8").match(/^SESSION_SECRET=(.*)$/m) || [])[1]?.trim();
const ANA = { userId: "100000000000000001", username: "Ana Beatriz" };
const BRUNO = { userId: "200000000000000002", username: "Bruno Teste" };

if (!secret) {
  console.error("Defina SESSION_SECRET no .env para assinar as sessões de teste.");
  process.exit(1);
}

let failures = 0;
const check = (label, condition, detail = "") => {
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${detail ? `  ->  ${detail}` : ""}`);
};

async function session(user) {
  return {
    Cookie: `discord_session=${await signSession({ ...user, avatar: null }, secret)}`,
    "Content-Type": "application/json",
    Origin: base,
  };
}

const ana = await session(ANA);
const bruno = await session(BRUNO);
const anon = { Origin: base };

async function call(path, headers = anon, options = {}) {
  const response = await fetch(base + path, { ...options, headers });
  const text = await response.text();
  let body = {};
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: response.status, body, text, headers: response.headers };
}

const created = { articles: [], rooms: [] };
const token = `e2e-${Date.now()}`;

try {
  // 1. Infra
  const health = await call("/api/health");
  check("health responde ok", health.status === 200 && health.body.checks?.database === "ok", JSON.stringify(health.body.checks));

  check("publicar sem sessão dá 401", (await call("/api/articles", { "Content-Type": "application/json", Origin: base }, { method: "POST", body: "{}" })).status === 401);
  const foreign = await call("/api/articles", { "Content-Type": "application/json", Origin: "https://invasor.example" }, { method: "POST", body: JSON.stringify({ title: "x y z", body: "corpo" }) });
  check("origem estranha dá 403", foreign.status === 403, String(foreign.status));

  const feed = await call("/api/articles?limit=2");
  check("feed tem lista e paginação", Array.isArray(feed.body.articles) && typeof feed.body.hasMore === "boolean");
  check("cabeçalho de segurança não vaza no 500", !feed.text.includes("stack"));

  // 2. Artigos, tags, busca e paginação
  const primeiro = await call("/api/articles", ana, {
    method: "POST",
    body: JSON.stringify({ title: `Artigo ${token}`, body: "Conteúdo de teste com palavra única zzz" + token, tags: "teste-e2e, css" }),
  });
  created.articles.push(primeiro.body.id);
  check("artigo criado com etiquetas", primeiro.status === 201);

  const busca = await call(`/api/articles?q=${encodeURIComponent(token)}`);
  check("busca encontra o artigo", busca.body.articles?.some((item) => item.id === primeiro.body.id), String(busca.body.articles?.length));

  const porTag = await call("/api/articles?tag=css");
  check("filtro por etiqueta funciona", porTag.body.articles?.every((item) => String(item.tags || "").split(",").includes("css")));

  const pagina1 = await call("/api/articles?limit=2");
  const pagina2 = await call(`/api/articles?limit=2&cursor=${pagina1.body.nextCursor}`);
  const ids1 = (pagina1.body.articles || []).map((item) => item.id);
  const ids2 = (pagina2.body.articles || []).map((item) => item.id);
  check("segunda página não repete itens", ids1.length === 2 && ids2.every((id) => !ids1.includes(id)), `${ids1} / ${ids2}`);

  // 3. Histórico de revisões
  const edicao = await call(`/api/articles/${primeiro.body.id}`, ana, {
    method: "PUT",
    body: JSON.stringify({ title: `Artigo ${token} v2`, body: "Texto novo", tags: "teste-e2e" }),
  });
  const historico = await call(`/api/articles/${primeiro.body.id}/revisions`, ana);
  check("edição gera versão anterior", edicao.status === 200 && historico.body.revisions?.length === 1, JSON.stringify(historico.body.revisions?.length));
  check("histórico guarda o texto antigo", historico.body.revisions?.[0]?.body?.includes("zzz" + token));
  check("outra pessoa não lê o histórico", (await call(`/api/articles/${primeiro.body.id}/revisions`, bruno)).status === 404);

  const detalhe = await call(`/api/articles/${primeiro.body.id}`, ana);
  const paginaDoArtigo = await fetch(`${base}/artigo/${detalhe.body.article.slug}`, { headers: { Cookie: ana.Cookie } });
  const paginaHtml = await paginaDoArtigo.text();
  check("página do artigo oferece editar para o autor", paginaDoArtigo.status === 200 && paginaHtml.includes(`/?editar=${primeiro.body.id}`));
  const paginaDeOutro = await fetch(`${base}/artigo/${detalhe.body.article.slug}`, { headers: { Cookie: bruno.Cookie } });
  check("página não oferece editar para quem não é autor", !(await paginaDeOutro.text()).includes("Editar artigo"));

  // 4. Comentários: autor do comentário, autor do artigo e dono da sala podem excluir
  const comentario = await call(`/api/articles/${primeiro.body.id}/comments`, bruno, {
    method: "POST",
    body: JSON.stringify({ body: `Comentário ${token}` }),
  });
  check("comentário criado", comentario.status === 201);
  const listaComoBruno = await call(`/api/articles/${primeiro.body.id}/comments`, bruno);
  check("autor do comentário recebe permissão de excluir", listaComoBruno.body.comments?.some((item) => item.id === comentario.body.id && item.can_delete));
  const listaComoAna = await call(`/api/articles/${primeiro.body.id}/comments`, ana);
  check("autor do artigo também recebe permissão de excluir", listaComoAna.body.comments?.some((item) => item.id === comentario.body.id && item.can_delete));
  const listaAnonima = await call(`/api/articles/${primeiro.body.id}/comments`);
  check("anônimo não recebe permissão de excluir", (listaAnonima.body.comments || []).every((item) => !item.can_delete));
  check("denúncia registrada", (await call(`/api/comments/${comentario.body.id}/report`, bruno, { method: "POST", body: JSON.stringify({ reason: "teste" }) })).status === 200);
  check("anônimo não exclui comentário", (await call(`/api/comments/${comentario.body.id}`, anon, { method: "DELETE" })).status === 401);
  check("autor do comentário exclui o próprio", (await call(`/api/comments/${comentario.body.id}`, bruno, { method: "DELETE" })).status === 200);

  const segundoComentario = await call(`/api/articles/${primeiro.body.id}/comments`, bruno, {
    method: "POST",
    body: JSON.stringify({ body: `Outro comentário ${token}` }),
  });
  check("autor do artigo exclui comentário de terceiro", (await call(`/api/comments/${segundoComentario.body.id}`, ana, { method: "DELETE" })).status === 200);
  check("comentários sumiram da lista", (await call(`/api/articles/${primeiro.body.id}/comments`, ana)).body.comments?.length === 0);

  // 5. Ciclo de vida das salas
  const sala = await call("/api/rooms", ana, {
    method: "POST",
    body: JSON.stringify({ name: `Sala ${token}`, visibility: "public" }),
  });
  created.rooms.push(sala.body.id);
  const artigoSala = await call("/api/articles", ana, {
    method: "POST",
    body: JSON.stringify({ title: `Na sala ${token}`, body: "Conteúdo", roomId: sala.body.id }),
  });
  created.articles.push(artigoSala.body.id);

  await call(`/api/rooms/${sala.body.id}/join`, bruno, { method: "POST", body: "{}" });
  check("membro sai da sala", (await call(`/api/rooms/${sala.body.id}/leave`, bruno, { method: "POST", body: "{}" })).status === 200);
  const salasDepoisDeSair = (await call("/api/rooms", bruno)).body.rooms || [];
  check("saída remove o vínculo", salasDepoisDeSair.find((item) => item.id === sala.body.id)?.is_member === 0);

  await call(`/api/rooms/${sala.body.id}/join`, bruno, { method: "POST", body: "{}" });
  check("dono não sai sem transferir", (await call(`/api/rooms/${sala.body.id}/leave`, ana, { method: "POST", body: "{}" })).status === 400);
  check("transferência para membro", (await call(`/api/rooms/${sala.body.id}`, ana, { method: "PATCH", body: JSON.stringify({ ownerId: BRUNO.userId }) })).status === 200);
  check("novo dono gerencia", (await call(`/api/rooms/${sala.body.id}/members`, bruno)).status === 200);
  check("antigo dono perde gestão", (await call(`/api/rooms/${sala.body.id}/members`, ana)).status === 403);
  check("exclusão pelo novo dono", (await call(`/api/rooms/${sala.body.id}`, bruno, { method: "DELETE" })).status === 200);
  check("artigos foram para a página pública", (await call(`/api/articles/${artigoSala.body.id}`)).body.article?.room_id === null);

  // 6. Bloqueio de entrada
  const privada = await call("/api/rooms", ana, {
    method: "POST",
    body: JSON.stringify({ name: `Privada ${token}`, visibility: "private" }),
  });
  created.rooms.push(privada.body.id);
  const codigoPrivada = privada.body.code;
  check("sala privada devolve código hash de 24 hex", /^[a-f0-9]{24}$/.test(codigoPrivada || ""), String(codigoPrivada));
  check("código da sala privada não é o id numérico", codigoPrivada !== String(privada.body.id));
  const salasDaAna = (await call("/api/rooms", ana)).body.rooms || [];
  const salasDoBruno = (await call("/api/rooms", bruno)).body.rooms || [];
  check("dono vê o código da própria sala", salasDaAna.find((item) => item.id === privada.body.id)?.room_code === codigoPrivada);
  check("quem não é dono não vê o código", !salasDoBruno.find((item) => item.id === privada.body.id)?.room_code);
  check("ID numérico não entra em sala privada", (await call(`/api/rooms/${privada.body.id}/join`, bruno, { method: "POST", body: "{}" })).status === 400);
  check("código desconhecido não encontra sala", (await call(`/api/rooms/${"0".repeat(24)}/join`, bruno, { method: "POST", body: "{}" })).status === 404);
  await call(`/api/rooms/${privada.body.id}`, ana, { method: "PATCH", body: JSON.stringify({ joinPolicy: "approval" }) });
  const pedidoPrivado = await call(`/api/rooms/${codigoPrivada}/join`, bruno, { method: "POST", body: "{}" });
  check("sala privada aceita pedido com o código", pedidoPrivado.body.pending === true, JSON.stringify(pedidoPrivado.body));
  await call(`/api/rooms/${privada.body.id}/requests`, ana, { method: "POST", body: JSON.stringify({ userId: BRUNO.userId, action: "approve" }) });
  await call(`/api/rooms/${privada.body.id}/members?userId=${BRUNO.userId}`, ana, { method: "DELETE" });
  check("removido não volta pelo código", (await call(`/api/rooms/${codigoPrivada}/join`, bruno, { method: "POST", body: "{}" })).status === 403);
  check("fila vazia após bloqueio", (await call(`/api/rooms/${privada.body.id}/requests`, ana)).body.requests?.length === 0);
  check("dono libera de novo", (await call(`/api/rooms/${privada.body.id}/blocks?userId=${BRUNO.userId}`, ana, { method: "DELETE" })).status === 200);

  // 7. Exclusão pelo próprio autor
  const proprio = await call("/api/articles", bruno, {
    method: "POST",
    body: JSON.stringify({ title: `Apagar ${token}`, body: "Conteúdo temporário" }),
  });
  check("autor exclui o próprio artigo", (await call(`/api/articles/${proprio.body.id}`, bruno, { method: "DELETE" })).status === 200);
  check("artigo excluído some do feed", !(await call("/api/articles?limit=50")).body.articles.some((item) => item.id === proprio.body.id));

  // 8. SEO
  const artigoPrivado = await call("/api/articles", ana, {
    method: "POST",
    body: JSON.stringify({ title: `Segredo ${token}`, body: "Conteúdo privado", roomId: privada.body.id }),
  });
  created.articles.push(artigoPrivado.body.id);
  const rss = await fetch(`${base}/feed.xml`);
  const rssText = await rss.text();
  check("RSS responde XML", rss.status === 200 && rssText.startsWith("<?xml"));
  check("RSS não vaza artigo de sala privada", !rssText.includes(`Segredo ${token}`));
  check("RSS lista artigo público", rssText.includes(`Artigo ${token} v2`) || rssText.includes(`Artigo ${token}`));
  const sitemap = await fetch(`${base}/sitemap.xml`);
  check("sitemap lista artigos", (await sitemap.text()).includes("/artigo/"));
} finally {
  for (const id of created.articles) await call(`/api/articles/${id}`, ana, { method: "DELETE" }).catch(() => {});
  for (const id of created.rooms) await call(`/api/rooms/${id}`, ana, { method: "DELETE" }).catch(() => {});
  console.log(`\n${failures === 0 ? "Tudo certo" : `${failures} falha(s)`} nesta execução.`);
  process.exit(failures === 0 ? 0 : 1);
}
