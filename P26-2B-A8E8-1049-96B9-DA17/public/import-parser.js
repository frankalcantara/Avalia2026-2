/* Acervo: leitor de citações para importação (md / txt / Kindle). Funções puras, sem DOM.
   Navegador: window.QuoteImport. Node: module.exports (para testes).
   Nenhum texto de interface aqui: erros saem como códigos ("required", "tooLong"...). */
(function (root) {
  "use strict";

  const LIMITS = { text: 2000, author: 200, work: 300, reflection: 3000, tags: 8, tag: 30, items: 200, fileBytes: 1048576 };

  const DASH_CLASS = "—–―";                       // travessões
  const RE_ATTR_LINE = /^\s*(?:[—–―]|--+)\s*(\S.*)$/;   // "— Autor"
  const RE_ATTR_HYPHEN = /^\s*-\s+(\S.*)$/;             // "- Autor" (só com contexto)
  const RE_ATTR_PAREN = /^\s*\((.+)\)\s*$/;             // "(Autor, Obra, p. 12)"
  const RE_PAGE = /^(?:p|pp|pág|pag|página|pagina|page)\.?\s*(\d+)\b.*$/i;
  const RE_HASHTAG = /#([\p{L}\p{N}_-]+)/gu;
  const RE_TAG_ONLY_LINE = /^\s*(?:#[\p{L}\p{N}_-]+\s*)+$/u;
  const RE_TAG_TRAIL = /((?:\s+#[\p{L}\p{N}_-]+)+)\s*$/u;
  const RE_KINDLE_META = /^\s*[-–—]\s*(Seu destaque|Sua nota|Seu marcador|Sua anotação|Your Highlight|Your Note|Your Bookmark|(?:Highlight|Note|Bookmark)(?=\s+(?:on|at)\s|\s*\|))\b(.*)$/i;
  const LABELS = {
    text: /^(?:cita[çc][ãa]o|trecho|quote|quotation|excerpt|passage|texto)$/i,
    author: /^(?:autor|autora|author)$/i,
    work: /^(?:obra|livro|fonte|work|source|title|t[ií]tulo)$/i,
    page: /^(?:p[áa]gina|pagina|p[áa]g|pag|page)$/i,
    reflection: /^(?:reflex[ãa]o|reflexao|nota|anota[çc][ãa]o|reflection|note|notes|comment|thoughts?)$/i,
    tags: /^(?:tags?|etiquetas?|marcadores)$/i,
  };
  // Sem \s* adjacentes (ambíguos => backtracking quadrático em linhas com muitos espaços).
  const RE_LABEL = /^\s*(?:[-*]\s+)?(?:\*+\s*)?([A-Za-zÀ-ÿ]+)(?:\s*\*+)?\s*:\s*(?:\*+\s*)?([\s\S]*)$/;
  const OPEN_Q = "“\"«‘„";
  const CLOSE_Q = "”\"»’“";

  /* ---------- utilidades ---------- */
  // String.prototype.trim é linear; /\s+$/ é quadrático em textos com longos trechos de espaços.
  const trim = (s) => String(s == null ? "" : s).trim();

  // Mesma regra do servidor ([\p{L}\p{N}_-], 1-30, sem '#', minúsculas). Regexes lineares, sem aninhamento.
  function normalizeTag(t) {
    let s = String(t == null ? "" : t).normalize("NFC").trim().replace(/^#+/, "").toLowerCase();
    s = s.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-+/, "");
    s = s.slice(0, LIMITS.tag).replace(/-+$/, "");
    return s;
  }
  function normalizeTags(list) {
    const seen = new Set(), out = [];
    for (const raw of list || []) {
      const t = normalizeTag(raw);
      if (t && !seen.has(t)) { seen.add(t); out.push(t); if (out.length >= LIMITS.tags) break; }
    }
    return out;
  }
  // Cada item separado por vírgula/;/quebra de linha é uma tag (espaço não separa).
  function splitTagString(s) { return normalizeTags(String(s || "").split(/[,;\n]/)); }

  function stripQuotes(s) {
    let t = trim(s);
    if (t.length >= 2 && OPEN_Q.includes(t[0]) && CLOSE_Q.includes(t[t.length - 1])) t = trim(t.slice(1, -1));
    return t;
  }
  function stripEmphasis(s) { return trim(s).replace(/^[*_]+|[*_]+$/g, "").trim(); }

  /* "Autor, Obra, p. 12" -> {author, work, page} */
  function parseAttribution(raw) {
    let s = trim(raw).replace(/^[—–―-]+\s*/, "");
    const outer = s.match(/^\((.+)\)$/);
    if (outer) s = outer[1];
    s = s.replace(/[.;]\s*$/, "");
    let page = "";
    const parts = [];
    for (const p of s.split(/\s*,\s*/)) {
      const m = p.trim().match(RE_PAGE);
      if (m && !page) page = m[1]; else if (p.trim()) parts.push(p.trim());
    }
    let author = stripEmphasis(stripQuotes(parts[0] || ""));
    let work = stripEmphasis(stripQuotes(parts.slice(1).join(", ")));
    const par = author.match(/^(.+?)\s*\((.+)\)$/);            // "Autor (Obra)"
    if (par && !work) { author = trim(par[1]); work = stripEmphasis(par[2]); }
    return { author, work, page };
  }

  function emptyItem(format) {
    return { text: "", author: "", work: "", page: "", reflection: "", tags: [], format, authorExplicit: false };
  }

  /* Tira linhas de tags e #hashtags finais. Devolve {lines, tags}. */
  function extractTags(lines) {
    const tags = [];
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lab = line.match(/^\s*tags?\s*:\s*(.*)$/i);
      if (lab) { tags.push(...splitTagString(lab[1].replace(/#/g, ""))); continue; }
      if (RE_TAG_ONLY_LINE.test(line)) { for (const m of line.matchAll(RE_HASHTAG)) tags.push(m[1]); continue; }
      out.push(line);
    }
    if (out.length) {
      const last = out[out.length - 1];
      // Janela final limitada: o regex não ancorado é quadrático em linhas enormes.
      const off = Math.max(0, last.length - 2000);
      const m = last.slice(off).match(RE_TAG_TRAIL);
      const at = m ? off + m.index : -1;
      if (m && trim(last.slice(0, at))) {
        for (const x of m[1].matchAll(RE_HASHTAG)) tags.push(x[1]);
        out[out.length - 1] = last.slice(0, at);
      }
    }
    return { lines: out, tags: normalizeTags(tags) };
  }

  /* Procura " — Autor" no fim de uma linha. */
  function splitInlineAttribution(line) {
    const re = new RegExp("\\s[" + DASH_CLASS + "]\\s+|\\s--+\\s+", "g");
    let last = null, m;
    while ((m = re.exec(line)) !== null) last = m;
    if (last) {
      const head = trim(line.slice(0, last.index)), tail = trim(line.slice(last.index + last[0].length));
      if (head && tail && tail.length <= 160) return { head, tail };
    }
    const h = line.match(/^(.+\S)\s+-\s+(\S.{0,79})$/);          // " - " só com cauda curta
    if (h && h[2].split(/\s+/).length <= 8) return { head: trim(h[1]), tail: trim(h[2]) };
    return null;
  }

  /* “texto” resto  -> {head, tail} se o texto começa com aspas e fecha. */
  function splitQuoted(str) {
    const t = trim(str);
    if (!t || !OPEN_Q.includes(t[0])) return null;
    let close = -1;
    for (let i = t.length - 1; i > 0; i--) if (CLOSE_Q.includes(t[i])) { close = i; break; }
    if (close < 1) return null;
    const head = trim(t.slice(1, close));
    const tail = trim(t.slice(close + 1).replace(/^[\s,;:.]*[—–―-]*\s*/, ""));
    return { head, tail };
  }

  /* ---------- front matter ---------- */
  function parseFrontMatter(src) {
    const m = src.match(/^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/);
    if (!m) return { body: src, defaults: { author: "", work: "", tags: [] } };
    const d = { author: "", work: "", tags: [] };
    const lines = m[1].split("\n");
    for (let i = 0; i < lines.length; i++) {
      const kv = lines[i].match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      let val = trim(kv[2]).replace(/^["']|["']$/g, "");
      if (key === "title" || key === "titulo" || key === "título" || key === "work" || key === "obra") d.work = val;
      else if (key === "author" || key === "autor") d.author = val;
      else if (key === "tags" || key === "tag") {
        if (!val) {
          while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) { i++; d.tags.push(lines[i].replace(/^\s*-\s+/, "").replace(/^["']|["']$/g, "")); }
        } else {
          val = val.replace(/^\[|\]$/g, "");
          d.tags.push(...val.split(/,/).map((x) => x.replace(/^\s*["']?|["']?\s*$/g, "")));
        }
      }
    }
    d.tags = normalizeTags(d.tags);
    return { body: src.slice(m[0].length), defaults: d };
  }

  /* ---------- formato rotulado (Citação: / Autor: ...) ---------- */
  function labelKey(word) {
    for (const k of Object.keys(LABELS)) if (LABELS[k].test(word)) return k;
    return null;
  }
  function hasLabeledQuotes(lines) {
    return lines.some((l) => { const m = l.match(RE_LABEL); return m && labelKey(m[1]) === "text"; });
  }
  function parseLabeled(lines) {
    const items = [];
    let cur = null, field = null, ignored = 0;
    const finish = () => { if (cur) { items.push(cur); cur = null; field = null; } };
    const start = () => { finish(); cur = emptyItem("rotulado"); cur._raw = { tags: [] }; };
    for (const line of lines) {
      if (/^\s*(?:-{3,}|={3,}|\*{3,})\s*$/.test(line)) { finish(); continue; }
      const m = line.match(RE_LABEL);
      const key = m ? labelKey(m[1]) : null;
      if (key) {
        if (!cur) start();
        const has = key === "tags" ? false : !!cur[key];
        if (has) start();
        field = key;
        if (key === "tags") { cur._raw.tags.push(...splitTagString(m[2].replace(/#/g, ""))); }
        else cur[key] = m[2];
        continue;
      }
      if (/^#{1,6}\s/.test(line)) { ignored++; continue; }
      if (!cur) { if (!trim(line)) continue; start(); field = "text"; cur.text = line; continue; }
      if (field && field !== "tags" && field !== "page" && field !== "author" && field !== "work") cur[field] += "\n" + line;
      else if (trim(line)) { cur.reflection = cur.reflection ? cur.reflection + "\n" + line : cur.reflection; if (!cur.reflection) cur.text += "\n" + line; }
    }
    finish();
    for (const it of items) {
      for (const k of ["text", "author", "work", "reflection"]) it[k] = trim(it[k]);
      it.page = (String(it.page).match(/\d+/) || [""])[0];
      it.text = stripQuotes(it.text);
      it.tags = normalizeTags(it._raw.tags);
      delete it._raw;
      it.authorExplicit = !!it.author;
    }
    return { items, ignored };
  }

  /* ---------- Kindle / Notas ---------- */
  function hasKindle(lines) { return lines.some((l) => RE_KINDLE_META.test(l)); }
  function parseKindle(lines) {
    const metaIdx = [];
    lines.forEach((l, i) => { if (RE_KINDLE_META.test(l)) metaIdx.push(i); });
    const titleIdxOf = (m) => { let i = m - 1; while (i >= 0 && !trim(lines[i])) i--; return i; };
    const items = [];
    let ignored = 0;
    metaIdx.forEach((m, n) => {
      const tIdx = titleIdxOf(m);
      const nextT = n + 1 < metaIdx.length ? titleIdxOf(metaIdx[n + 1]) : lines.length;
      const kind = lines[m].match(RE_KINDLE_META)[1].toLowerCase();
      const body = trim(lines.slice(m + 1, Math.max(m + 1, nextT)).join("\n"));
      const titleLine = tIdx >= 0 && tIdx < m ? trim(lines[tIdx]).replace(/^﻿/, "") : "";
      const tm = titleLine.match(/^(.*\S)\s*\(([^()]*)\)\s*$/);
      const work = tm ? trim(tm[1]) : titleLine;
      const author = tm ? trim(tm[2]) : "";
      const pg = lines[m].match(/p[áa]gina\s+(\d+)|\bpage\s+(\d+)/i);
      const page = pg ? (pg[1] || pg[2]) : "";
      if (/marcador|bookmark/.test(kind)) { ignored++; return; }
      if (/nota|note|anota/.test(kind)) {
        const prev = [...items].reverse().find((x) => x.work === work);
        if (prev && body) { prev.reflection = prev.reflection ? prev.reflection + "\n" + body : body; return; }
      }
      if (!body) { ignored++; return; }
      const it = emptyItem("kindle");
      Object.assign(it, { text: stripQuotes(body), author, work, page, authorExplicit: !!author });
      if (/nota|note|anota/.test(kind)) it.reflection = "";
      items.push(it);
    });
    return { items, ignored };
  }

  /* ---------- blocos livres (blockquote, aspas, "Texto — Autor") ---------- */
  function parseBlocks(lines) {
    const blocks = [];
    let cur = [];
    for (const l of lines) {
      if (!trim(l)) { if (cur.length) { blocks.push(cur); cur = []; } }
      else cur.push(l);
    }
    if (cur.length) blocks.push(cur);

    const items = [];
    let ignored = 0;
    for (let b of blocks) {
      b = b.filter((l) => !/^\s*(?:-{3,}|={3,}|\*{3,})\s*$/.test(l));
      if (!b.length) continue;
      if (b.every((l) => /^#{1,6}\s/.test(l))) { ignored += b.length; continue; }
      b = b.filter((l) => !/^#{1,6}\s/.test(l));

      const tg = extractTags(b);
      b = tg.lines;
      if (!b.length) {                       // bloco só de tags: vale para o item anterior
        const prev = items[items.length - 1];
        if (prev && tg.tags.length) prev.tags = normalizeTags(prev.tags.concat(tg.tags));
        else if (tg.tags.length) { const it = emptyItem("livre"); it.tags = tg.tags; it.text = ""; items.push(it); }
        continue;
      }

      const isQuote = /^\s*>/.test(b[0]);
      if (isQuote) b = b.map((l) => l.replace(/^(\s*>\s?)+/, ""));

      // várias linhas "Texto — Autor" no mesmo bloco: uma citação por linha
      if (!isQuote && b.length > 1 && b.filter((l) => splitInlineAttribution(l)).length >= 2) {
        for (const l of b) {
          const sp = splitInlineAttribution(l);
          const li = emptyItem("linha");
          if (sp) Object.assign(li, { text: stripQuotes(sp.head) }, mergeAttr(li, parseAttribution(sp.tail)));
          else li.text = stripQuotes(l);
          li.tags = tg.tags;
          items.push(li);
        }
        continue;
      }
      const prev = items[items.length - 1];

      // bloco que é só atribuição, logo após um item sem autor
      if (b.length === 1) {
        const lone = b[0];
        const a1 = lone.match(RE_ATTR_LINE) || lone.match(RE_ATTR_PAREN) || (prev && !prev.authorExplicit ? lone.match(RE_ATTR_HYPHEN) : null);
        if (a1 && prev && !prev.authorExplicit && prev.text) {
          Object.assign(prev, mergeAttr(prev, parseAttribution(a1[1] || lone)));
          prev.tags = normalizeTags(prev.tags.concat(tg.tags));
          continue;
        }
      }

      const it = emptyItem(isQuote ? "blockquote" : "livre");
      it.tags = tg.tags;
      let attr = null;
      const lastLine = b[b.length - 1];
      const aLast = b.length > 1 || isQuote ? (lastLine.match(RE_ATTR_LINE) || lastLine.match(RE_ATTR_PAREN) || (b.length > 1 ? lastLine.match(RE_ATTR_HYPHEN) : null)) : null;
      if (aLast && b.length > 1) { attr = aLast[1] || lastLine; b = b.slice(0, -1); }
      else {
        const joined = trim(b.join("\n"));
        const q = splitQuoted(joined);
        if (q && q.tail) { it.text = q.head; attr = q.tail; b = null; }
        else if (q && !q.tail) { it.text = q.head; b = null; }
        else if (b.length === 1 || !attr) {
          const lastIsInline = splitInlineAttribution(lastLine);
          if (lastIsInline) {
            attr = lastIsInline.tail;
            b = b.slice(0, -1).concat([lastIsInline.head]);
          }
        }
      }
      if (b) it.text = stripQuotes(b.join("\n"));
      if (attr) { Object.assign(it, mergeAttr(it, parseAttribution(attr))); it.authorExplicit = !!it.author; }
      items.push(it);
    }
    return { items, ignored };
  }
  function mergeAttr(it, a) {
    const r = { author: a.author || it.author, work: a.work || it.work, page: a.page || it.page };
    r.authorExplicit = !!r.author;
    return r;
  }

  /* ---------- API principal ---------- */
  function parseText(input, opts) {
    const source = (opts && opts.source) || "";
    let src = String(input == null ? "" : input).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const fm = parseFrontMatter(src);
    const lines = fm.body.split("\n");

    // Segmenta em blocos (linha em branco ou "=====" do Kindle) e decide o formato de cada trecho.
    // Um bloco rotulado termina na linha em branco; bloco seguinte sem rótulo conhecido é um NOVO item.
    const labeledDoc = hasLabeledQuotes(lines);
    const blocks = [];
    let cur = [];
    for (const l of lines) {
      if (!trim(l) || /^\s*={5,}\s*$/.test(l)) { if (cur.length) { blocks.push(cur); cur = []; } }
      else cur.push(l);
    }
    if (cur.length) blocks.push(cur);
    const startsLabel = (b, tagsToo) => {
      if (!labeledDoc) return false;
      const m = b[0].match(RE_LABEL), k = m ? labelKey(m[1]) : null;
      return !!k && (tagsToo || k !== "tags");
    };
    const segs = [];
    let kBodyOpen = false;               // bloco Kindle com título+meta, ainda sem corpo
    for (const b of blocks) {
      const last = segs[segs.length - 1];
      const isMeta = b.some((l) => RE_KINDLE_META.test(l));
      if (isMeta) {
        if (last && last.type === "K") last.lines.push("", ...b); else segs.push({ type: "K", lines: b.slice() });
        kBodyOpen = RE_KINDLE_META.test(b[b.length - 1]);
      } else if (kBodyOpen && last && last.type === "K" && !/^\s*>/.test(b[0]) && !startsLabel(b, true)) {
        last.lines.push("", ...b); kBodyOpen = false;
      } else if (startsLabel(b, false) || (last && last.type === "L" && startsLabel(b, true))) {
        kBodyOpen = false;
        if (last && last.type === "L") last.lines.push("", ...b); else segs.push({ type: "L", lines: b.slice() });
      } else {
        kBodyOpen = false;
        if (last && last.type === "F") last.lines.push("", ...b); else segs.push({ type: "F", lines: b.slice() });
      }
    }
    const res = { items: [], ignored: 0 };
    for (const sg of segs) {
      const r = sg.type === "K" ? parseKindle(sg.lines) : sg.type === "L" ? parseLabeled(sg.lines) : parseBlocks(sg.lines);
      res.ignored += r.ignored || 0;
      for (const it of r.items) {
        const prev = res.items[res.items.length - 1];
        // bloco só de tags depois de outro formato: as tags vão para o item anterior
        if (sg.type === "F" && prev && !it.text && !it.author && !it.work && !it.reflection && it.tags.length) prev.tags = normalizeTags((prev.tags || []).concat(it.tags));
        else res.items.push(it);
      }
    }

    const d = fm.defaults;
    const items = res.items.map((it, i) => {
      const out = {
        text: trim(it.text), author: trim(it.author), work: trim(it.work), page: String(it.page || ""),
        reflection: trim(it.reflection), tags: normalizeTags((d.tags || []).concat(it.tags || [])),
        format: it.format, source, line: i + 1, authorFromDefault: false,
      };
      if (!out.author && d.author) { out.author = d.author; out.authorFromDefault = true; }
      if (!out.work && d.work) out.work = d.work;
      out.needsReview = !out.text || !out.author;
      return out;
    }).filter((it) => it.text || it.author || it.work || it.reflection);
    return { items, ignored: res.ignored || 0, defaults: d };
  }

  /* Erros por campo, como códigos. Mesmos limites do formulário/servidor. */
  function validateItem(it) {
    const e = {};
    const text = trim(it.text), author = trim(it.author);
    if (!text) e.text = "required"; else if (text.length > LIMITS.text) e.text = "tooLong";
    if (!author) e.author = "required"; else if (author.length > LIMITS.author) e.author = "tooLong";
    if (trim(it.work).length > LIMITS.work) e.work = "tooLong";
    if (trim(it.reflection).length > LIMITS.reflection) e.reflection = "tooLong";
    const page = String(it.page == null ? "" : it.page).trim();
    if (page !== "" && !/^\d+$/.test(page)) e.page = "notInteger";
    const tags = normalizeTags(it.tags);
    if (tags.length > LIMITS.tags) e.tags = "tooMany";
    else if (tags.some((t) => t.length > LIMITS.tag)) e.tags = "tagTooLong";
    return e;
  }

  // Igual ao servidor: só caixa, acentos e espaços; pontuação conta. Chave = autor + texto.
  function dupKey(it) {
    const norm = (s) => String(s == null ? "" : s).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
    return norm(it.author) + "\u0000" + norm(it.text);
  }
  /* Devolve Map(índice -> índice do primeiro igual) para repetidos no lote. */
  function findDuplicates(items) {
    const first = new Map(), dups = new Map();
    items.forEach((it, i) => {
      const k = dupKey(it);
      if (!k || k === "\u0000") return;
      if (first.has(k)) dups.set(i, first.get(k)); else first.set(k, i);
    });
    return dups;
  }

  /* Prepara o corpo do POST (mesmo formato do formulário: page como texto), sem campos de UI. */
  function toPayload(it) {
    const page = String(it.page == null ? "" : it.page).trim();
    return { text: trim(it.text), author: trim(it.author), work: trim(it.work), page: page, reflection: trim(it.reflection), tags: normalizeTags(it.tags) };
  }
  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  const api = { LIMITS, parseText, parseAttribution, validateItem, findDuplicates, normalizeTag, normalizeTags, splitTagString, toPayload, chunk };
  root.QuoteImport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
