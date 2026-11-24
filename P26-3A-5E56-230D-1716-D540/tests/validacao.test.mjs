// Testes unitários das validações (docs/ESPECIFICACAO.md 4.1, 4.2, 4.3 e 6.3–6.5).
// Rodar: npm test   (node --test, zero dependências)
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIAS,
  TIPOS,
  dataValida,
  hojeNoCampus,
  limparTexto,
  umAnoAntes,
  validarDataOcorrencia,
  validarFiltros,
  validarId,
  validarItem,
  validarReivindicacao,
} from "../functions/_lib/validacao.js";

// Relógio fixo: 09/11/2026 15:00 em São Paulo (18:00 UTC).
const AGORA = new Date("2026-11-09T18:00:00Z");

const base = () => ({
  tipo: "encontrei",
  categoria: "eletronicos",
  titulo: "Celular preto",
  descricao: "Celular encontrado no banco do bloco B.",
  local: "Bloco B",
  data_ocorrencia: "2026-11-08",
});

const r = (n, c = "a") => c.repeat(n);
const filtros = (q) => validarFiltros(new URLSearchParams(q));

describe("domínio fechado (seção 1)", () => {
  test("categorias e tipos do contrato", () => {
    assert.deepEqual([...CATEGORIAS].sort(), ["documentos", "eletronicos", "garrafas", "vestuario"]);
    assert.deepEqual([...TIPOS].sort(), ["encontrei", "perdi"]);
  });
});

describe("validarItem — corpo válido", () => {
  test("aceita corpo válido e devolve só os campos do contrato (extras ignorados)", () => {
    const v = validarItem({ ...base(), status: "encerrado", autor_id: "999", id: 7 }, AGORA);
    assert.equal(v.ok, true, JSON.stringify(v.erros));
    assert.deepEqual(Object.keys(v.valor).sort(), [
      "categoria",
      "data_ocorrencia",
      "descricao",
      "local",
      "tipo",
      "titulo",
    ]);
    assert.deepEqual(v.erros, {});
  });

  test("os dois tipos e as quatro categorias são aceitos", () => {
    for (const tipo of ["perdi", "encontrei"])
      for (const categoria of ["eletronicos", "documentos", "garrafas", "vestuario"])
        assert.equal(validarItem({ ...base(), tipo, categoria }, AGORA).ok, true, `${tipo}/${categoria}`);
  });

  test("corpo que não é objeto → erro", () => {
    for (const c of [null, [], "x", 3, undefined]) assert.equal(validarItem(c, AGORA).ok, false);
  });
});

describe("validarItem — tipo e categoria", () => {
  test("tipo inválido", () => {
    for (const tipo of ["achei", "", "PERDI", null, 1]) {
      const v = validarItem({ ...base(), tipo }, AGORA);
      assert.equal(v.ok, false);
      assert.ok(v.erros.tipo, `tipo=${tipo}`);
    }
  });
  test("categoria inválida", () => {
    for (const categoria of ["livros", "", "Eletronicos", "eletrônicos", null, ["eletronicos"]]) {
      const v = validarItem({ ...base(), categoria }, AGORA);
      assert.equal(v.ok, false);
      assert.ok(v.erros.categoria, `categoria=${categoria}`);
    }
  });
});

describe("validarItem — limites de tamanho (code points)", () => {
  test("titulo 2 → inválido, 3 → válido, 80 → válido, 81 → inválido", () => {
    assert.ok(validarItem({ ...base(), titulo: r(2) }, AGORA).erros.titulo);
    assert.equal(validarItem({ ...base(), titulo: r(3) }, AGORA).ok, true);
    assert.equal(validarItem({ ...base(), titulo: r(80) }, AGORA).ok, true);
    assert.ok(validarItem({ ...base(), titulo: r(81) }, AGORA).erros.titulo);
  });
  test("descricao 9/10/1000/1001", () => {
    assert.ok(validarItem({ ...base(), descricao: r(9) }, AGORA).erros.descricao);
    assert.equal(validarItem({ ...base(), descricao: r(10) }, AGORA).ok, true);
    assert.equal(validarItem({ ...base(), descricao: r(1000) }, AGORA).ok, true);
    assert.ok(validarItem({ ...base(), descricao: r(1001) }, AGORA).erros.descricao);
  });
  test("local 2/3/120/121", () => {
    assert.ok(validarItem({ ...base(), local: r(2) }, AGORA).erros.local);
    assert.equal(validarItem({ ...base(), local: r(3) }, AGORA).ok, true);
    assert.equal(validarItem({ ...base(), local: r(120) }, AGORA).ok, true);
    assert.ok(validarItem({ ...base(), local: r(121) }, AGORA).erros.local);
  });
  test("emoji conta como 1 caractere (80 emojis passam, 81 não)", () => {
    assert.equal(validarItem({ ...base(), titulo: "😀".repeat(80) }, AGORA).ok, true);
    assert.ok(validarItem({ ...base(), titulo: "😀".repeat(81) }, AGORA).erros.titulo);
  });
  test("o tamanho é medido DEPOIS do trim: '  ab  ' tem 2 → inválido", () => {
    assert.ok(validarItem({ ...base(), titulo: "  ab  " }, AGORA).erros.titulo);
  });
  test("campos ausentes ou não-texto → erro por campo", () => {
    const v = validarItem({ tipo: "perdi", categoria: "garrafas", titulo: 123, descricao: null }, AGORA);
    assert.equal(v.ok, false);
    for (const c of ["titulo", "descricao", "local", "data_ocorrencia"]) assert.ok(v.erros[c], c);
  });
});

describe("limpeza de texto (4.2 e 6.4)", () => {
  test("trim e \\t\\n\\r viram espaço", () => {
    assert.equal(limparTexto("  Bolsa\tazul\r\ncom\nzíper  "), "Bolsa azul com zíper");
  });
  test("caracteres de controle e bidi são removidos", () => {
    assert.equal(limparTexto("a\u0000b\u0007c\u007Fd\u0085e‮f⁦g"), "abcdefg");
  });
  test("controle não conta para o mínimo: 'a\\u0000\\u0001b' tem 2 → titulo inválido", () => {
    assert.ok(validarItem({ ...base(), titulo: "a\u0000\u0001b" }, AGORA).erros.titulo);
  });
  test("valor limpo é o que vai para o banco", () => {
    const v = validarItem({ ...base(), titulo: "  Gar\u0000rafa‮  " }, AGORA);
    assert.equal(v.ok, true);
    assert.equal(v.valor.titulo, "Garrafa");
  });
  test("não-string → null", () => {
    assert.equal(limparTexto(42), null);
    assert.equal(limparTexto(undefined), null);
  });
});

describe("data_ocorrencia (4.2 e 6.4: hoje em America/Sao_Paulo, [hoje−1 ano, hoje])", () => {
  test("hoje no campus", () => {
    assert.equal(hojeNoCampus(AGORA), "2026-11-09");
    // 01:30 UTC do dia 10 ainda é dia 09 em São Paulo (UTC−3).
    assert.equal(hojeNoCampus(new Date("2026-11-10T01:30:00Z")), "2026-11-09");
  });
  test("hoje é aceito; amanhã (futuro) é rejeitado", () => {
    assert.equal(validarDataOcorrencia("2026-11-09", AGORA).ok, true);
    assert.equal(validarDataOcorrencia("2026-11-10", AGORA).ok, false);
    assert.equal(validarDataOcorrencia("2027-01-01", AGORA).ok, false);
  });
  test("data UTC já virou mas São Paulo não: '2026-11-10' é futuro às 01:30Z do dia 10", () => {
    assert.equal(validarDataOcorrencia("2026-11-10", new Date("2026-11-10T01:30:00Z")).ok, false);
  });
  test("exatamente 1 ano atrás é aceito; 1 ano + 1 dia é rejeitado", () => {
    assert.equal(validarDataOcorrencia("2025-11-09", AGORA).ok, true);
    assert.equal(validarDataOcorrencia("2025-11-08", AGORA).ok, false);
    assert.equal(validarDataOcorrencia("2020-01-01", AGORA).ok, false);
  });
  test("ano bissexto: hoje 29/02/2028 → limite 28/02/2027", () => {
    assert.equal(umAnoAntes("2028-02-29"), "2027-02-28");
    const agora = new Date("2028-02-29T15:00:00Z");
    assert.equal(validarDataOcorrencia("2027-02-28", agora).ok, true);
    assert.equal(validarDataOcorrencia("2027-02-27", agora).ok, false);
  });
  test("formato e calendário inválidos", () => {
    for (const d of ["2026-02-30", "2026-13-01", "2026-00-10", "09/11/2026", "2026-1-5", "2026-11-09T00:00", "", null, 20261109])
      assert.equal(dataValida(d), false, String(d));
    assert.equal(dataValida("2024-02-29"), true);
    assert.equal(dataValida("2025-02-29"), false);
  });
  test("validarItem expõe o erro em erros.data_ocorrencia", () => {
    assert.ok(validarItem({ ...base(), data_ocorrencia: "2026-11-10" }, AGORA).erros.data_ocorrencia);
    assert.ok(validarItem({ ...base(), data_ocorrencia: "2025-11-08" }, AGORA).erros.data_ocorrencia);
  });
});

describe("validarReivindicacao (4.3: mensagem 10–500)", () => {
  test("9/10/500/501", () => {
    assert.equal(validarReivindicacao({ mensagem: r(9) }).ok, false);
    assert.equal(validarReivindicacao({ mensagem: r(10) }).ok, true);
    assert.equal(validarReivindicacao({ mensagem: r(500) }).ok, true);
    assert.equal(validarReivindicacao({ mensagem: r(501) }).ok, false);
  });
  test("ausente, não-texto ou corpo inválido", () => {
    assert.equal(validarReivindicacao({}).ok, false);
    assert.equal(validarReivindicacao({ mensagem: 1234567890123 }).ok, false);
    assert.equal(validarReivindicacao(null).ok, false);
    assert.equal(validarReivindicacao([]).ok, false);
  });
});

describe("validarId (6.3)", () => {
  test("inteiros positivos aceitos", () => {
    assert.equal(validarId("1"), 1);
    assert.equal(validarId("42"), 42);
  });
  test("não numérico / zero / negativo / com lixo → null", () => {
    for (const v of ["abc", "0", "-1", "1.5", "01", "1e3", " 1", "1;DROP TABLE itens", "", undefined])
      assert.equal(validarId(v), null, String(v));
  });
});

describe("validarFiltros (4.1 e 6.5)", () => {
  test("sem filtros → padrão (status null = todos menos encerrado, por_pagina 12)", () => {
    const v = filtros("");
    assert.equal(v.ok, true);
    assert.equal(v.valor.status, null);
    assert.equal(v.valor.por_pagina, 12);
    assert.equal(v.valor.pagina, 1);
    assert.equal(v.valor.ordem, "recentes");
    assert.equal(v.valor.meus, false);
  });
  test("filtros cruzados válidos", () => {
    const v = filtros("tipo=perdi&categoria=garrafas&status=todos&q=azul&local=bloco&de=2026-01-01&ate=2026-11-09&meus=1&ordem=antigos&pagina=2&por_pagina=50");
    assert.equal(v.ok, true, JSON.stringify(v.erros));
    assert.equal(v.valor.tipo, "perdi");
    assert.equal(v.valor.categoria, "garrafas");
    assert.equal(v.valor.status, "todos");
    assert.equal(v.valor.meus, true);
    assert.equal(v.valor.por_pagina, 50);
  });
  test("cada status do item é aceito", () => {
    for (const s of ["aberto", "em_devolucao", "encerrado", "todos"]) assert.equal(filtros(`status=${s}`).ok, true, s);
  });
  test("valor vazio = ausente", () => {
    const v = filtros("tipo=&categoria=&status=&q=&de=&ate=&pagina=&por_pagina=");
    assert.equal(v.ok, true);
    assert.equal(v.valor.tipo, null);
    assert.equal(v.valor.status, null);
  });
  test("valores inválidos → 400 (erro por campo)", () => {
    const casos = {
      tipo: "tipo=achei",
      categoria: "categoria=livros",
      status: "status=perdido",
      ordem: "ordem=aleatoria",
      pagina: "pagina=0",
      por_pagina: "por_pagina=51",
      de: "de=2026-02-30",
      meus: "meus=sim",
    };
    for (const [campo, q] of Object.entries(casos)) {
      const v = filtros(q);
      assert.equal(v.ok, false, q);
      assert.ok(v.erros[campo], `${q} deveria marcar ${campo}`);
    }
    assert.equal(filtros("por_pagina=0").ok, false);
    assert.equal(filtros("pagina=-1").ok, false);
    assert.equal(filtros("pagina=abc").ok, false);
  });
  test("q: 60 chars ok, 61 → erro", () => {
    assert.equal(filtros(`q=${r(60)}`).ok, true);
    assert.ok(filtros(`q=${r(61)}`).erros.q);
  });
  test("de > ate → erro", () => {
    assert.equal(filtros("de=2026-11-09&ate=2026-11-01").ok, false);
    assert.equal(filtros("de=2026-11-01&ate=2026-11-01").ok, true);
  });
});
