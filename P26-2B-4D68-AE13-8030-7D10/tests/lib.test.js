import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SLUG_PATTERN, generateSlug, parseArticleInput } from "../functions/_lib/articles.js";
import { renderMarkdown, sanitizeHtml } from "../public/js/markdown.js";
import { excerpt } from "../public/js/text.js";
import {
  JOIN_POLICIES, ROOM_CODE_PATTERN, canViewRoom, generateRoomCode, normalizeRoomCode, resolveJoin,
} from "../functions/_lib/rooms.js";
import {
  SESSION_COOKIE, clearedCookie, getSession, readCookie, serializeCookie, sessionCookie, signSession,
} from "../functions/_lib/session.js";

const SECRET = "s".repeat(32);

function requestWithCookie(cookie, url = "https://blog.dev/api") {
  return { url, headers: { get: (name) => (name.toLowerCase() === "cookie" ? cookie : null) } };
}

function fakeDb(respond) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return { first: async () => respond(sql, args) };
        },
      };
    },
  };
}

describe("parseArticleInput", () => {
  it("normaliza título, corpo e sala opcional", () => {
    assert.deepEqual(
      parseArticleInput({ title: "  Um título  ", body: "  conteúdo  ", roomId: "" }),
      { title: "Um título", body: "conteúdo", roomId: null, tags: [] },
    );
    assert.equal(parseArticleInput({ title: "abc", body: "x", roomId: 7 }).roomId, 7);
    assert.equal(parseArticleInput({ title: "abc", body: "x", roomId: "7" }).roomId, 7);
    assert.equal(parseArticleInput({ title: "abc", body: "x" }).roomId, null);
  });

  it("exige título entre 3 e 140 caracteres", () => {
    const curto = parseArticleInput({ title: "ab", body: "x" });
    assert.equal(curto.error, "O título deve ter entre 3 e 140 caracteres.");
    assert.ok(parseArticleInput({ title: "a".repeat(141), body: "x" }).error);
    assert.equal(parseArticleInput({ title: "a".repeat(140), body: "x" }).error, undefined);
  });

  it("exige corpo entre 1 e 50.000 caracteres", () => {
    assert.equal(parseArticleInput({ title: "abc", body: "   " }).error, "O artigo deve ter entre 1 e 50.000 caracteres.");
    assert.ok(parseArticleInput({ title: "abc", body: "a".repeat(50001) }).error);
    assert.equal(parseArticleInput({ title: "abc", body: "a".repeat(50000) }).error, undefined);
  });

  it("rejeita sala inválida", () => {
    for (const roomId of ["abc", 0, -1, 1.5, Number.NaN, {}]) {
      assert.equal(parseArticleInput({ title: "abc", body: "x", roomId }).error, "Sala inválida.");
    }
  });

  it("rejeita corpo ausente ou não textual", () => {
    assert.ok(parseArticleInput(null).error);
    assert.ok(parseArticleInput({ title: 42, body: ["x"] }).error);
  });
});

describe("código hash da sala privada", () => {
  it("gera 24 caracteres hex a partir do id da sala", async () => {
    const primeiro = await generateRoomCode(2);
    assert.match(primeiro, /^[a-f0-9]{24}$/);
    assert.ok(ROOM_CODE_PATTERN.test(primeiro));
  });

  it("não repete o código entre salas nem entre gerações", async () => {
    const codigos = new Set([
      await generateRoomCode(2), await generateRoomCode(2), await generateRoomCode(3),
    ]);
    assert.equal(codigos.size, 3);
  });

  it("normaliza o código digitado com espaços e maiúsculas", () => {
    const codigo = "a1b2c3d4e5f60718293a4b5c";
    assert.equal(normalizeRoomCode(`  ${codigo.toUpperCase()} `), codigo);
    assert.equal(normalizeRoomCode("abc"), "");
    assert.equal(normalizeRoomCode("<script>"), "");
  });

  it("aceita o nonce de 36 hex das salas privadas antigas", () => {
    assert.ok(ROOM_CODE_PATTERN.test("a".repeat(36)));
    assert.equal(ROOM_CODE_PATTERN.test("a".repeat(17)), false);
    assert.equal(ROOM_CODE_PATTERN.test("a".repeat(65)), false);
  });
});

describe("canViewRoom", () => {
  it("libera sala pública sem consultar membros", async () => {
    const db = fakeDb(() => ({ visibility: "public" }));
    assert.equal(await canViewRoom(db, 1, ""), true);
    assert.equal(db.calls.length, 1);
    assert.deepEqual(db.calls[0].args, [1]);
  });

  it("libera sala privada para membro", async () => {
    const db = fakeDb((sql) => (sql.includes("room_members") ? { 1: 1 } : { visibility: "private" }));
    assert.equal(await canViewRoom(db, 2, "42"), true);
    assert.equal(db.calls.length, 2);
    assert.deepEqual(db.calls[1].args, [2, "42"]);
  });

  it("bloqueia sala privada para não membro", async () => {
    const db = fakeDb((sql) => (sql.includes("room_members") ? null : { visibility: "private" }));
    assert.equal(await canViewRoom(db, 2, "42"), false);
    assert.equal(db.calls.length, 2);
  });

  it("bloqueia sala privada sem usuário sem consultar membros", async () => {
    const db = fakeDb(() => ({ visibility: "private" }));
    assert.equal(await canViewRoom(db, 2, ""), false);
    assert.equal(db.calls.length, 1);
  });

  it("nega sala inexistente", async () => {
    const db = fakeDb(() => null);
    assert.equal(await canViewRoom(db, 99, "42"), false);
  });
});

describe("sessão assinada", () => {
  it("assina e valida de volta, normalizando tipos", async () => {
    const token = await signSession({ userId: 42, username: "Ana", avatar: null }, SECRET);
    const session = await getSession(requestWithCookie(`${SESSION_COOKIE}=${token}`), SECRET);
    assert.deepEqual(session, { userId: "42", username: "Ana", avatar: null });
  });

  it("rejeita assinatura adulterada", async () => {
    const token = await signSession({ userId: "42", username: "Ana", avatar: null }, SECRET);
    const [payload, signature] = token.split(".");
    // Adultera o primeiro caractere da assinatura: os bits finais do base64url podem ser padding,
    // então mexer no último caractere nem sempre muda os bytes verificados.
    const adulterado = `${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    assert.equal(await getSession(requestWithCookie(`${SESSION_COOKIE}=${adulterado}`), SECRET), null);
  });

  it("rejeita token assinado com outro segredo", async () => {
    const token = await signSession({ userId: "42", username: "Ana", avatar: null }, SECRET);
    assert.equal(await getSession(requestWithCookie(`${SESSION_COOKIE}=${token}`), "t".repeat(32)), null);
  });

  it("rejeita cookie ausente, vazio ou malformado", async () => {
    assert.equal(await getSession(requestWithCookie(""), SECRET), null);
    assert.equal(await getSession(requestWithCookie(`${SESSION_COOKIE}=`), SECRET), null);
    assert.equal(await getSession(requestWithCookie(`${SESSION_COOKIE}=a.b.c`), SECRET), null);
    assert.equal(await getSession(requestWithCookie(`${SESSION_COOKIE}=semassinatura`), SECRET), null);
  });

  it("rejeita token expirado", async (t) => {
    const token = await signSession({ userId: "42", username: "Ana", avatar: null }, SECRET);
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 25 * 60 * 60 * 1000 });
    assert.equal(await getSession(requestWithCookie(`${SESSION_COOKIE}=${token}`), SECRET), null);
  });

  it("recusa segredo curto", async () => {
    assert.equal(await getSession(requestWithCookie(`${SESSION_COOKIE}=abc`), "curto"), null);
    await assert.rejects(() => signSession({ userId: "1", username: "x" }, "curto"), /SESSION_SECRET/);
  });
});

describe("cookies", () => {
  it("marca Secure apenas em https", () => {
    const https = serializeCookie("a", "b", { url: "https://blog.dev/" }, 60);
    const http = serializeCookie("a", "b", { url: "http://127.0.0.1:8788/" }, 60);
    assert.match(https, /; Secure$/);
    assert.doesNotMatch(http, /Secure/);
    assert.match(http, /HttpOnly/);
    assert.match(http, /SameSite=Lax/);
    assert.match(http, /Max-Age=60/);
  });

  it("cookie de sessão e de limpeza respeitam o Max-Age", () => {
    assert.match(sessionCookie("token", { url: "https://blog.dev/" }), /Max-Age=86400/);
    assert.match(clearedCookie(SESSION_COOKIE, { url: "https://blog.dev/" }), /^discord_session=;/);
    assert.match(clearedCookie(SESSION_COOKIE, { url: "https://blog.dev/" }), /Max-Age=0/);
  });

  it("lê o cookie certo entre vários", () => {
    const request = requestWithCookie(`outro=1; ${SESSION_COOKIE}=abc.def; resto=2`);
    assert.equal(readCookie(request, SESSION_COOKIE), "abc.def");
    assert.equal(readCookie(request, "inexistente"), "");
  });
});

describe("pedido de entrada na sala", () => {
  it("aceita as duas políticas conhecidas", () => {
    assert.deepEqual(JOIN_POLICIES, ["open_link", "approval"]);
  });

  it("mantém membro como está", () => {
    assert.equal(resolveJoin({ isMember: true, visibility: "private", joinPolicy: "approval" }), "already_member");
  });

  it("sala privada entra só com o ID, sem código de convite", () => {
    assert.equal(resolveJoin({ isMember: false, visibility: "private", joinPolicy: "open_link" }), "joined");
  });

  it("entra direto em sala pública", () => {
    assert.equal(resolveJoin({ isMember: false, visibility: "public", joinPolicy: "open_link" }), "joined");
  });

  it("deixa pendente quando o dono exige aprovação", () => {
    assert.equal(resolveJoin({ isMember: false, visibility: "private", joinPolicy: "approval" }), "pending");
  });
});

describe("figura SVG no Markdown", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#2f725f"/></svg>`;

  it("embute o SVG como imagem em data URL", () => {
    const html = renderMarkdown("Antes\n\n```svg\n" + svg + "\n```\n\nDepois");
    assert.match(html, /<img class="article-svg" src="data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+" alt="Figura SVG" loading="lazy"/);
    assert.match(html, /<p>Antes<\/p>/);
    assert.match(html, /<p>Depois<\/p>/);
  });

  it("não injeta a marcação do SVG no HTML", () => {
    const html = renderMarkdown("```svg\n" + svg + "\n```");
    assert.equal(html.includes("<svg"), false);
    assert.equal(html.includes("<script"), false);
  });

  it("script dentro do bloco svg vira dados inertes", () => {
    const html = renderMarkdown("```svg\n<svg><script>alert(1)</script></svg>\n```");
    assert.equal(html.includes("alert(1)"), false);
    assert.match(html, /data:image\/svg\+xml;base64,/);
  });

  it("bloco de código comum continua escapado", () => {
    assert.equal(renderMarkdown("```js\nconst a = 1 < 2;\n```"), "<pre><code>const a = 1 &lt; 2;</code></pre>");
  });

  it("resumo ignora blocos de código", () => {
    assert.equal(excerpt("Texto\n\n```svg\n<svg></svg>\n```"), "Texto");
  });

  it("usa o <title> do SVG como texto alternativo", () => {
    const html = renderMarkdown("```svg\n<svg><title>Fluxo do login</title><rect width=\"4\" height=\"4\"/></svg>\n```");
    assert.match(html, /alt="Fluxo do login"/);
  });

  it("SVG gigante volta a ser bloco de código", () => {
    const gigante = "<svg>" + "<rect width=\"1\" height=\"1\"/>".repeat(2000) + "</svg>";
    assert.ok(gigante.length > 40000);
    const html = renderMarkdown("```svg\n" + gigante + "\n```");
    assert.match(html, /^<pre><code>&lt;svg&gt;/);
    assert.equal(html.includes("article-svg"), false);
  });

  it("conteúdo que não é SVG não vira imagem", () => {
    for (const texto of ["apenas texto", "<div>nada</div>", "<svg>sem fechamento"]) {
      const html = renderMarkdown("```svg\n" + texto + "\n```");
      assert.equal(html.includes("article-svg"), false, texto);
      assert.match(html, /<pre><code>/);
    }
  });
});

describe("slug do artigo", () => {
  it("gera 32 caracteres hex (128 bits)", () => {
    assert.match(generateSlug(), SLUG_PATTERN);
  });

  it("não repete valores", () => {
    const slugs = new Set(Array.from({ length: 200 }, () => generateSlug()));
    assert.equal(slugs.size, 200);
  });

  it("rejeita formatos que não são slug", () => {
    for (const value of ["3", "ABC", "x".repeat(32), "a".repeat(31), "a".repeat(33)]) {
      assert.equal(SLUG_PATTERN.test(value), false, value);
    }
  });
});

const { readFileSync } = await import("node:fs");

describe("contraste do texto cinza (WCAG AA)", () => {
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const luminancia = (hex) => {
    const [r, g, b] = hex.replace("#", "").match(/../g).map((parte) => parseInt(parte, 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (fg, bg) => {
    const [alto, baixo] = [luminancia(fg), luminancia(bg)].sort((a, b) => b - a);
    return (alto + 0.05) / (baixo + 0.05);
  };
  const muted = css.match(/--muted:\s*(#[0-9a-f]{6})/i)[1];

  it("--muted passa em 4.5:1 nos fundos onde aparece", () => {
    for (const fundo of ["#ffffff", "#f7f8f5", "#edf4ee"]) {
      const taxa = contraste(muted, fundo);
      assert.ok(taxa >= 4.5, `${muted} sobre ${fundo} = ${taxa.toFixed(2)}:1`);
    }
  });

  it("excertos e textos de apoio usam a cor --muted", () => {
    assert.match(css, /\.article-excerpt \{[^}]*color: var\(--muted\)/);
    assert.match(css, /\.side-copy \{[^}]*color: var\(--muted\)/);
    assert.equal(css.includes("#6d7873"), false);
    assert.equal(css.includes("#78827e"), false);
  });
});

const tagsLib = await import("../functions/_lib/tags.js");
const textoLib = await import("../public/js/text.js");

describe("etiquetas", () => {
  it("normaliza acentos, espaços e maiúsculas", () => {
    assert.equal(tagsLib.normalizeTag("Segurança de Redes"), "seguranca-de-redes");
    assert.equal(tagsLib.normalizeTag("  CSS  "), "css");
    assert.equal(tagsLib.normalizeTag("!!!"), "");
  });

  it("aceita lista ou texto separado por vírgula, sem repetir", () => {
    assert.deepEqual(tagsLib.parseTags("css, d1 ,css").tags, ["css", "d1"]);
    assert.deepEqual(tagsLib.parseTags(["Banco de Dados"]).tags, ["banco-de-dados"]);
    assert.deepEqual(tagsLib.parseTags(undefined).tags, []);
  });

  it("recusa mais de cinco etiquetas", () => {
    const resultado = tagsLib.parseTags("a1,b2,c3,d4,e5,f6");
    assert.match(resultado.error, /no máximo 5/);
  });
});

describe("leitura e sumário", () => {
  it("gera ids de título iguais aos usados no HTML", () => {
    const markdown = "## Primeiros passos\n\ntexto\n\n### Detalhe fino\n\n## Primeiros passos";
    const headings = textoLib.extractHeadings(markdown);
    assert.deepEqual(headings.map((item) => item.id), ["primeiros-passos", "detalhe-fino", "primeiros-passos-1"]);
    const html = renderMarkdown(markdown);
    for (const heading of headings) assert.ok(html.includes(`id="${heading.id}"`), heading.id);
  });

  it("ignora títulos dentro de bloco de código", () => {
    assert.equal(textoLib.extractHeadings("```\n## não é título\n```").length, 0);
  });

  it("estima tempo de leitura em minutos", () => {
    assert.equal(textoLib.readingTime("palavra"), 1);
    assert.ok(textoLib.readingTime("palavra ".repeat(1000)) > 1);
  });
});

describe("imagens no Markdown", () => {
  it("imagem externa não vira tag img (nem link solto)", () => {
    const externa = renderMarkdown("![x](https://exemplo.com/a.png)");
    assert.equal(externa.includes("<img"), false);
    assert.equal(externa.includes("<a "), false);
    assert.match(externa, /!\[x\]/);
  });
});

describe("tabelas no Markdown", () => {
  it("monta thead e tbody a partir das barras", () => {
    const html = renderMarkdown("| Item | Total |\n| --- | ---: |\n| CSS | 2 |\n| D1 | 5 |");
    assert.match(html, /^<table><thead><tr><th>Item<\/th><th class="align-right">Total<\/th><\/tr><\/thead>/);
    assert.match(html, /<tbody><tr><td>CSS<\/td><td class="align-right">2<\/td><\/tr>/);
    assert.match(html, /<td>D1<\/td>/);
    assert.match(html, /<\/tbody><\/table>$/);
  });

  it("aplica alinhamento central com dois pontos", () => {
    const html = renderMarkdown("a | b\n:---: | ---\n1 | 2");
    assert.match(html, /<th class="align-center">a<\/th>/);
  });

  it("célula aceita negrito e código inline", () => {
    const html = renderMarkdown("| x |\n| --- |\n| **forte** `c` |");
    assert.match(html, /<td><strong>forte<\/strong> <code>c<\/code><\/td>/);
  });

  it("linhas com barra sem separador continuam parágrafo", () => {
    const html = renderMarkdown("a | b\ncontinua");
    assert.equal(html.includes("<table>"), false);
    assert.match(html, /<p>a \| b<br>continua<\/p>/);
  });
});

describe("HTML sanitizado no artigo", () => {
  it("renderiza tags permitidas de um bloco ```html", () => {
    const html = renderMarkdown("```html\n<h2>Passos</h2>\n<p>Texto <strong>forte</strong> e <a href=\"https://exemplo.com\">link</a>.</p>\n```");
    assert.match(html, /<h2>Passos<\/h2>/);
    assert.match(html, /<strong>forte<\/strong>/);
    assert.match(html, /<a href="https:\/\/exemplo.com" target="_blank" rel="noopener noreferrer">link<\/a>/);
  });

  it("aceita SVG inline dentro do bloco html", () => {
    const html = renderMarkdown("```html\n<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" fill=\"#2f725f\"/></svg>\n```");
    assert.match(html, /<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#2f725f"><\/svg>/);
  });

  it("documento HTML completo vira só o conteúdo do body", () => {
    const documento = [
      "<!DOCTYPE html>",
      '<html lang="pt-BR">',
      "<head>",
      "  <meta charset=\"UTF-8\">",
      "  <title>Interfaces em C#</title>",
      "  <style>body { display: none }</style>",
      "</head>",
      "<body>",
      "  <main><article><header><h1>Interfaces em C#</h1></header>",
      "    <section><h2>O que é</h2><p>Um contrato.</p></section>",
      "  </article></main>",
      "</body>",
      "</html>",
    ].join("\n");
    const html = renderMarkdown("```html\n" + documento + "\n```");
    // <main> vira <div> para não aninhar duas <main> na página do artigo.
    assert.match(html, /<div><article><header><h1>Interfaces em C#<\/h1><\/header>/);
    assert.match(html, /<section><h2>O que é<\/h2><p>Um contrato.<\/p><\/section>/);
    assert.equal(html.includes("<main>"), false);
    assert.equal(html.includes("&lt;html"), false);
    assert.equal(html.includes("<!DOCTYPE"), false);
    assert.equal(html.includes("Interfaces em C#<\/title>"), false);
    assert.equal(html.includes("display: none"), false);
  });

  it("remove script, style e iframe com o conteúdo", () => {
    const html = sanitizeHtml(
      "<p>ok</p><script>alert(1)</script><style>body{display:none}</style><iframe src=\"https://x\"></iframe>",
    );
    assert.equal(html, "<p>ok</p>");
  });

  it("limpa atributos de evento e URLs perigosas", () => {
    const html = sanitizeHtml("<p onclick=\"alert(1)\" style=\"color:red\">a</p><a href=\"javascript:alert(1)\">b</a>");
    assert.equal(html.includes("onclick"), false);
    assert.equal(html.includes("style="), false);
    assert.equal(html.includes("javascript:"), false);
    assert.match(html, /<a>b<\/a>/);
  });

  it("descarta imagem fora do http(s)", () => {
    assert.equal(sanitizeHtml("<img src=\"data:image/svg+xml;base64,AAAA\">"), "");
    assert.match(sanitizeHtml("<img src=\"https://a.png\" alt=\"x\">"), /<img src="https:\/\/a.png" alt="x">/);
  });

  it("tag desconhecida aparece como texto escapado", () => {
    assert.equal(sanitizeHtml("<form action=\"/x\">oi</form>"), "");
    assert.equal(sanitizeHtml("<marquee>oi</marquee>"), "&lt;marquee&gt;oi&lt;/marquee&gt;");
  });

  it("bloco ```js continua como código escapado", () => {
    assert.equal(renderMarkdown("```js\n<p>x</p>\n```"), "<pre><code>&lt;p&gt;x&lt;/p&gt;</code></pre>");
  });
});
