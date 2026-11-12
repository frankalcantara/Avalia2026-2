// Testes unitários das regras de negócio (functions/_lib/rules.js).
// Zero dependências: apenas node:test e node:assert. Rodar com: node --test tests/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CHAVE_UNICA,
  STATUSES,
  SEVERITIES,
  TRANSITIONS,
  LIMITS,
  cleanText,
  validateTicketInput,
  validateComment,
  validateStatusChange,
  canTransition,
  isClosed,
  parseAdminIds,
  isAdmin,
  canChangeStatus,
  allowedTransitionsFor,
  generateTicketCode,
  TICKET_CODE_REGEX,
  normalizeTicketCode,
  parseListFilters,
  parseCookies,
} from "../functions/_lib/rules.js";

const ALL = Object.keys(STATUSES);
const valid = () => ({
  title: "Projetor do Lab 3 não liga",
  location: "Laboratório 3",
  severity: "alta",
  description: "O projetor não acende desde ontem à tarde.",
});

describe("constantes", () => {
  test("chave única do projeto", () => {
    assert.equal(CHAVE_UNICA, "P26-2C-7200-F0C5-B458-DA41");
  });
  test("4 estados e 4 severidades", () => {
    assert.deepEqual(ALL, ["aberto", "em_analise", "aguardando", "resolvido"]);
    assert.deepEqual(Object.keys(SEVERITIES), ["baixa", "media", "alta", "critica"]);
  });
  test("todo destino da máquina de estados é um estado conhecido", () => {
    for (const [from, tos] of Object.entries(TRANSITIONS)) {
      assert.ok(ALL.includes(from));
      for (const to of tos) assert.ok(ALL.includes(to), `${from} → ${to}`);
    }
  });
});

describe("cleanText", () => {
  test("não-string vira string vazia", () => {
    for (const v of [undefined, null, 42, {}, [], true]) assert.equal(cleanText(v), "");
  });
  test("linha única: caracteres de controle viram espaço e pontas são aparadas", () => {
    assert.equal(cleanText("  a\u0000b\u0007c\nd\te\u007F  "), "a b c d e");
  });
  test("multilinha: preserva \\n e \\t, normaliza \\r\\n, remove outros controles", () => {
    assert.equal(cleanText("a\r\nb\rc\u0000d\te\u001B", { multiline: true }), "a\nb\ncd\te");
  });
  test("normaliza Unicode para NFC", () => {
    assert.equal(cleanText("é"), "é");
  });
});

describe("validateTicketInput", () => {
  test("payload válido é aceito e normalizado", () => {
    const r = validateTicketInput({ ...valid(), title: "  Projetor   ", severity: " ALTA " });
    assert.equal(r.ok, true);
    assert.equal(r.data.title, "Projetor");
    assert.equal(r.data.severity, "alta");
  });
  test("corpo ausente/não-objeto gera erro em todos os campos", () => {
    for (const body of [null, undefined, "x", 5]) {
      const r = validateTicketInput(body);
      assert.equal(r.ok, false);
      assert.deepEqual(Object.keys(r.errors).sort(), ["description", "location", "severity", "title"]);
    }
  });
  test("título: limites 5..120 (contando caracteres, não bytes)", () => {
    const [min, max] = LIMITS.title;
    assert.equal(validateTicketInput({ ...valid(), title: "ab" }).errors.title.includes("pelo menos 5"), true);
    assert.ok(validateTicketInput({ ...valid(), title: "x".repeat(min - 1) }).errors.title);
    assert.equal(validateTicketInput({ ...valid(), title: "x".repeat(min) }).ok, true);
    assert.equal(validateTicketInput({ ...valid(), title: "x".repeat(max) }).ok, true);
    assert.match(validateTicketInput({ ...valid(), title: "x".repeat(max + 1) }).errors.title, /no máximo 120/);
    // 120 emojis (2 unidades UTF-16 cada) ainda são 120 caracteres
    assert.equal(validateTicketInput({ ...valid(), title: "🔥".repeat(120) }).ok, true);
  });
  test("título só com espaços/controles é rejeitado", () => {
    assert.ok(validateTicketInput({ ...valid(), title: " \u0000\u0001  \n " }).errors.title);
  });
  test("título não-string (número/objeto) é rejeitado", () => {
    assert.ok(validateTicketInput({ ...valid(), title: 123456 }).errors.title);
    assert.ok(validateTicketInput({ ...valid(), title: { a: 1 } }).errors.title);
  });
  test("local: limites 2..80", () => {
    assert.ok(validateTicketInput({ ...valid(), location: "L" }).errors.location);
    assert.equal(validateTicketInput({ ...valid(), location: "L3" }).ok, true);
    assert.equal(validateTicketInput({ ...valid(), location: "x".repeat(80) }).ok, true);
    assert.ok(validateTicketInput({ ...valid(), location: "x".repeat(81) }).errors.location);
  });
  test("descrição: limites 10..4000 e multilinha preservada", () => {
    assert.ok(validateTicketInput({ ...valid(), description: "curta" }).errors.description);
    assert.ok(validateTicketInput({ ...valid(), description: "x".repeat(4001) }).errors.description);
    const r = validateTicketInput({ ...valid(), description: "linha 1\r\nlinha 2" });
    assert.equal(r.ok, true);
    assert.equal(r.data.description, "linha 1\nlinha 2");
  });
  test("severidade inválida ('urgente', vazia, não-string, protótipo)", () => {
    for (const severity of ["urgente", "", undefined, 3, "__proto__", "toString", "constructor"]) {
      const r = validateTicketInput({ ...valid(), severity });
      assert.equal(r.ok, false, String(severity));
      assert.match(r.errors.severity, /Severidade inválida/);
    }
  });
  test("todas as severidades válidas são aceitas", () => {
    for (const severity of Object.keys(SEVERITIES)) assert.equal(validateTicketInput({ ...valid(), severity }).ok, true);
  });
  test("título com <script> é aceito como texto puro (escape é papel da UI)", () => {
    const r = validateTicketInput({ ...valid(), title: "<script>alert(1)</script>" });
    assert.equal(r.ok, true);
    assert.equal(r.data.title, "<script>alert(1)</script>");
  });
  test("campos extras são descartados", () => {
    const r = validateTicketInput({ ...valid(), status: "resolvido", author_id: "1" });
    assert.deepEqual(Object.keys(r.data).sort(), ["description", "location", "severity", "title"]);
  });
});

describe("validateComment", () => {
  test("vazio, só espaços e 1 caractere são rejeitados", () => {
    for (const body of [undefined, "", "   ", "a", "\u0000\u0000"]) assert.ok(validateComment({ body }).errors.body, JSON.stringify(body));
    assert.equal(validateComment(null).ok, false);
  });
  test("longo demais (2001) é rejeitado; 2000 é aceito", () => {
    assert.ok(validateComment({ body: "x".repeat(2001) }).errors.body);
    assert.equal(validateComment({ body: "x".repeat(2000) }).ok, true);
  });
  test("comentário válido é aparado e mantém quebras de linha", () => {
    const r = validateComment({ body: "  Trocado o cabo.\r\nTestado.  " });
    assert.deepEqual(r, { ok: true, data: { body: "Trocado o cabo.\nTestado." } });
  });
});

describe("validateStatusChange", () => {
  test("destino precisa ser um estado conhecido", () => {
    assert.equal(validateStatusChange({ status: "em_analise" }).ok, true);
    for (const status of ["fechado", "", undefined, "EM_ANALISE", "__proto__", "hasOwnProperty"]) {
      assert.ok(validateStatusChange({ status }).errors.status, String(status));
    }
  });
  test("observação opcional, máx. 1000", () => {
    assert.deepEqual(validateStatusChange({ status: "resolvido" }).data, { status: "resolvido", note: "" });
    assert.equal(validateStatusChange({ status: "resolvido", note: "x".repeat(1000) }).ok, true);
    assert.ok(validateStatusChange({ status: "resolvido", note: "x".repeat(1001) }).errors.note);
  });
  test("corpo nulo é rejeitado sem exceção", () => {
    assert.equal(validateStatusChange(null).ok, false);
  });
});

describe("máquina de estados", () => {
  const expected = new Set([
    "aberto>em_analise",
    "aberto>resolvido",
    "em_analise>aguardando",
    "em_analise>resolvido",
    "aguardando>em_analise",
    "aguardando>resolvido",
  ]);
  for (const from of ALL) {
    for (const to of ALL) {
      const ok = expected.has(`${from}>${to}`);
      test(`${from} → ${to}: ${ok ? "válida" : "inválida"}`, () => {
        assert.equal(canTransition(from, to), ok);
      });
    }
  }
  test("resolvido é final", () => {
    assert.deepEqual(TRANSITIONS.resolvido, []);
    assert.equal(isClosed("resolvido"), true);
    for (const s of ["aberto", "em_analise", "aguardando"]) assert.equal(isClosed(s), false);
  });
  test("estados desconhecidos/protótipo não quebram", () => {
    assert.equal(canTransition("xyz", "aberto"), false);
    assert.equal(canTransition("__proto__", "aberto"), false);
    assert.equal(canTransition("constructor", "aberto"), false);
    assert.equal(canTransition(undefined, undefined), false);
  });
});

describe("ADMIN_DISCORD_IDS", () => {
  test("aceita vírgula, espaço, ponto-e-vírgula e quebra de linha; ignora lixo", () => {
    const ids = parseAdminIds(" 111111111111111111, 222222222222222222;333333333333333333\n abc, 12, ");
    assert.deepEqual([...ids].sort(), ["111111111111111111", "222222222222222222", "333333333333333333"]);
  });
  test("vazio/indefinido = ninguém é técnico", () => {
    assert.equal(parseAdminIds(undefined).size, 0);
    assert.equal(isAdmin({}, "111111111111111111"), false);
    assert.equal(isAdmin(null, "111111111111111111"), false);
  });
  test("isAdmin compara como string", () => {
    const env = { ADMIN_DISCORD_IDS: "111111111111111111" };
    assert.equal(isAdmin(env, "111111111111111111"), true);
    assert.equal(isAdmin(env, "999999999999999999"), false);
  });
});

describe("permissões de mudança de estado", () => {
  const AUTHOR = "200000000000000002";
  const OTHER = "300000000000000003";
  const TECH = "100000000000000001";
  const t = (status) => ({ status, author_id: AUTHOR });

  test("técnico: toda transição válida é permitida", () => {
    for (const from of ALL) for (const to of TRANSITIONS[from]) {
      assert.deepEqual(canChangeStatus({ userId: TECH, admin: true, ticket: t(from), to }), { ok: true });
    }
  });
  test("técnico: transição inválida = 409 (ex.: aberto → aguardando)", () => {
    const r = canChangeStatus({ userId: TECH, admin: true, ticket: t("aberto"), to: "aguardando" });
    assert.equal(r.ok, false);
    assert.equal(r.status, 409);
  });
  test("chamado resolvido: 409 para qualquer um, com mensagem de fechado", () => {
    for (const to of ALL) {
      const r = canChangeStatus({ userId: TECH, admin: true, ticket: t("resolvido"), to });
      assert.equal(r.status, 409);
      assert.match(r.error, /resolvido/);
    }
  });
  test("autor: só pode marcar como resolvido", () => {
    assert.equal(canChangeStatus({ userId: AUTHOR, admin: false, ticket: t("aberto"), to: "resolvido" }).ok, true);
    assert.equal(canChangeStatus({ userId: AUTHOR, admin: false, ticket: t("aguardando"), to: "resolvido" }).ok, true);
    const r = canChangeStatus({ userId: AUTHOR, admin: false, ticket: t("aberto"), to: "em_analise" });
    assert.deepEqual([r.ok, r.status], [false, 403]);
  });
  test("autor com id numérico também é reconhecido (comparação por string)", () => {
    const ticket = { status: "aberto", author_id: "123456" };
    assert.equal(canChangeStatus({ userId: 123456, admin: false, ticket, to: "resolvido" }).ok, true);
  });
  test("outro usuário: 403 em qualquer transição válida", () => {
    for (const from of ALL) for (const to of TRANSITIONS[from]) {
      const r = canChangeStatus({ userId: OTHER, admin: false, ticket: t(from), to });
      assert.deepEqual([r.ok, r.status], [false, 403], `${from} → ${to}`);
    }
  });
  test("transição inválida tem prioridade (409) sobre permissão (403)", () => {
    const r = canChangeStatus({ userId: OTHER, admin: false, ticket: t("aberto"), to: "aguardando" });
    assert.equal(r.status, 409);
  });
  test("allowedTransitionsFor espelha canChangeStatus", () => {
    assert.deepEqual(allowedTransitionsFor({ userId: TECH, admin: true, ticket: t("aberto") }), ["em_analise", "resolvido"]);
    assert.deepEqual(allowedTransitionsFor({ userId: TECH, admin: true, ticket: t("em_analise") }), ["aguardando", "resolvido"]);
    assert.deepEqual(allowedTransitionsFor({ userId: AUTHOR, admin: false, ticket: t("em_analise") }), ["resolvido"]);
    assert.deepEqual(allowedTransitionsFor({ userId: OTHER, admin: false, ticket: t("aberto") }), []);
    assert.deepEqual(allowedTransitionsFor({ userId: TECH, admin: true, ticket: t("resolvido") }), []);
    assert.deepEqual(allowedTransitionsFor({ userId: TECH, admin: true, ticket: t("inexistente") }), []);
  });
});

describe("código do chamado CH-XXXXXX", () => {
  const fixed = (vals) => () => Uint8Array.from(vals);
  test("formato e alfabeto Crockford (sem I, L, O, U)", () => {
    assert.equal(generateTicketCode(fixed([0, 1, 2, 3, 4, 5])), "CH-012345");
    assert.equal(generateTicketCode(fixed([31, 30, 18, 19, 20, 255])), "CH-ZYJKMZ");
    for (let i = 0; i < 2000; i++) {
      const code = generateTicketCode((n) => crypto.getRandomValues(new Uint8Array(n)));
      assert.match(code, TICKET_CODE_REGEX);
      assert.doesNotMatch(code.slice(3), /[ILOU]/);
    }
  });
  test("pede exatamente 6 bytes aleatórios", () => {
    let asked = 0;
    generateTicketCode((n) => { asked = n; return new Uint8Array(n); });
    assert.equal(asked, 6);
  });
  test("normalizeTicketCode aceita minúsculas/espaços e rejeita formatos errados", () => {
    assert.equal(normalizeTicketCode(" ch-7k2m9q "), "CH-7K2M9Q");
    for (const bad of ["CH-7K2M9", "CH-7K2M9QQ", "CH-7K2M9I", "CH-OOOOOO", "XX-123456", "CH_123456", "", null, undefined, "CH-12345\n6", "../CH-123456"]) {
      assert.equal(normalizeTicketCode(bad), null, String(bad));
    }
  });
});

describe("filtros da listagem", () => {
  const p = (qs) => parseListFilters(new URLSearchParams(qs));
  test("sem filtros", () => {
    assert.deepEqual(p(""), { status: null, severity: null, q: null, mine: false });
  });
  test("valores válidos", () => {
    assert.deepEqual(p("status=em_analise&severity=critica&q=%20projetor%20&mine=1"), {
      status: "em_analise", severity: "critica", q: "projetor", mine: true,
    });
  });
  test("valores desconhecidos/protótipo são ignorados", () => {
    assert.deepEqual(p("status=fechado&severity=__proto__&mine=true"), { status: null, severity: null, q: null, mine: false });
    assert.equal(p("status=constructor").status, null);
  });
  test("busca é limpa de controles e limitada a 80 caracteres", () => {
    assert.equal(p("q=" + "a".repeat(200)).q.length, 80);
    assert.equal(p("q=a%00b").q, "a b");
    assert.equal(p("q=%20%20").q, null);
  });
});

describe("parseCookies", () => {
  test("vários cookies, espaços e valores codificados", () => {
    assert.deepEqual(parseCookies("a=1; it_session=abc%3D; b = 2 "), { a: "1", it_session: "abc=", b: "2" });
  });
  test("valor contendo '=' é preservado", () => {
    assert.equal(parseCookies("x=a=b=c").x, "a=b=c");
  });
  test("cabeçalho ausente/vazio/malformado não quebra", () => {
    assert.deepEqual(parseCookies(undefined), {});
    assert.deepEqual(parseCookies(""), {});
    assert.deepEqual(parseCookies(";;semIgual; =semNome"), {});
  });
  test("percent-encoding inválido mantém o valor bruto", () => {
    assert.equal(parseCookies("it_session=%E0%A4%A").it_session, "%E0%A4%A");
  });
});
