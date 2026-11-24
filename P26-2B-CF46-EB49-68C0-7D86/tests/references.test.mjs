import assert from "node:assert/strict";
import test from "node:test";
import {
  compileBibliography, formatReference, validateReference,
} from "../public/references.mjs";

const common = { author: "Ana Silva", year: "2024", location: "Curitiba, Brasil" };
const book = { ...common, title: "Pesquisa Aplicada", publisher: "Editora Horizonte" };
const article = {
  ...common, title: "Método experimental", journal: "Revista Exemplo",
  volume: "3", issue: "2", pages: "10-20", doi: "10.1234/demo",
};
const website = {
  ...common, title: "Guia de pesquisa", site: "Portal Exemplo",
  url: "https://example.org/guia", accessDate: "2025-02-01",
};

// Dados fictícios. ABNT NBR 6023:2025 §§7.1, 7.7.5–6, 7.20 e 8;
// IEEE Reference Style Guide for Authors II.A, II.M e II.T.
const cases = [
  ["abnt", "book", book, "SILVA, Ana. Pesquisa Aplicada. Curitiba, Brasil: Editora Horizonte, 2024.", "Pesquisa Aplicada"],
  ["abnt", "article", article,
    "SILVA, Ana. Método experimental. Revista Exemplo, Curitiba, Brasil, v. 3, n. 2, p. 10-20, 2024. DOI: 10.1234/demo.", "Revista Exemplo"],
  ["abnt", "website", website,
    "SILVA, Ana. Guia de pesquisa. Portal Exemplo, 2024. Disponível em: https://example.org/guia. Acesso em: 1 fev. 2025.", "Portal Exemplo"],
  ["ieee", "book", book,
    "[1] A. Silva, Pesquisa Aplicada. Curitiba, Brasil: Editora Horizonte, 2024.", "Pesquisa Aplicada"],
  ["ieee", "article", article,
    "[1] A. Silva, “Método experimental,” Revista Exemplo, vol. 3, no. 2, pp. 10–20, 2024, doi: 10.1234/demo.", "Revista Exemplo"],
  ["ieee", "website", website,
    "[1] A. Silva. “Guia de pesquisa.” Portal Exemplo. Accessed: Feb. 1, 2025. [Online]. Available: https://example.org/guia", null],
];
for (const [style, sourceType, fields, text, italic] of cases) {
  test(`${style}/${sourceType}: ordem, pontuação, autoria e grifo`, () => {
    const validated = validateReference({ style, sourceType, fields });
    assert.equal(validated.ok, true, JSON.stringify(validated.errors));
    const parts = formatReference(validated.value);
    assert.deepEqual(
      { text: parts.map(part => part.text).join(""), italic: parts.filter(part => part.italic).map(part => part.text) },
      { text, italic: italic ? [italic] : [] },
    );
  });
}

test("validação independente dos campos do formulário", () => {
  for (const [sourceType, fields, required] of [
    ["book", book, "publisher"], ["article", article, "journal"], ["website", website, "site"],
  ]) {
    const invalid = validateReference({ style: "abnt", sourceType, fields: { ...fields, [required]: " " } });
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors[required]);
  }
  const invalidDate = validateReference({ style: "abnt", sourceType: "website", fields: { ...website, accessDate: "2025-02-29" } });
  assert.equal(invalidDate.ok, false);
  assert.ok(invalidDate.errors.accessDate);
  const missingDate = validateReference({ style: "ieee", sourceType: "website", fields: { ...website, accessDate: "" } });
  assert.equal(missingDate.ok, false);
  assert.ok(missingDate.errors.accessDate);
});

test("ordem determinística, acentos, caixa, autoria ausente e numeração IEEE", () => {
  const make = (id, author, title) => ({ id, sourceType: "book", fields: { ...book, author, title } });
  const entries = [
    make("five", "Marcos Souza", "Pesquisa"),
    make("four", "Leo alvaro", "Zulu"),
    make("two", "Lea Álvaro", "Beta"),
    make("same", "Lea Álvaro", "Beta"),
    make("one", "Leo ALVARO", "Beta"),
    make("three", "", "Ciência"),
  ];
  const expected = ["four", "one", "same", "two", "three", "five"];
  for (const style of ["abnt", "ieee"]) {
    const compiled = compileBibliography(entries, style);
    assert.deepEqual(compiled.map(item => item.id), expected);
    assert.deepEqual(compileBibliography(entries.toReversed(), style), compiled);
    if (style === "ieee") {
      for (const [index, { text }] of compiled.entries()) assert.ok(text.startsWith(`[${index + 1}] `));
    }
  }
});
