// Conferência das listas de palavras do Cypher.
// Uso: node tests/conferir-palavras.mjs
import { ANSWERS } from "../src/data/answers.js";
import { VALID } from "../src/data/valid.js";

const normalizar = (w) =>
  w.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const falhas = [];
const validas = VALID.split(" ");
const conjuntoValidas = new Set(validas);

if (conjuntoValidas.size !== validas.length) falhas.push("VALID contém duplicatas");
const validasForaPadrao = validas.filter((w) => !/^[A-Z]{5}$/.test(w));
if (validasForaPadrao.length) falhas.push(`VALID fora do padrão A-Z/5: ${validasForaPadrao.slice(0, 10).join(", ")}`);

const chaves = ANSWERS.map(normalizar);
const respostasForaPadrao = ANSWERS.filter((w, i) => !/^[A-Z]{5}$/.test(chaves[i]));
if (respostasForaPadrao.length) falhas.push(`ANSWERS fora do padrão: ${respostasForaPadrao.join(", ")}`);

const vistas = new Set();
const duplicadas = [];
for (const k of chaves) {
  if (vistas.has(k)) duplicadas.push(k);
  vistas.add(k);
}
if (duplicadas.length) falhas.push(`ANSWERS duplicadas após normalização: ${duplicadas.join(", ")}`);

const foraDoDicionario = chaves.filter((k) => !conjuntoValidas.has(k));
if (foraDoDicionario.length) falhas.push(`ANSWERS ausentes de VALID: ${foraDoDicionario.join(", ")}`);

const caixaBaixa = ANSWERS.filter((w) => w !== w.toUpperCase());
if (caixaBaixa.length) falhas.push(`ANSWERS fora de caixa alta: ${caixaBaixa.join(", ")}`);

if (chaves.includes("COFRE")) falhas.push("COFRE (palavra de demonstração) está em ANSWERS");

console.log(`Respostas (ANSWERS): ${ANSWERS.length}`);
console.log(`Chutes válidos (VALID): ${validas.length}`);
console.log(`Dias sem repetição (2 palavras por dia): ${Math.floor(ANSWERS.length / 2)}`);

if (falhas.length) {
  console.error("FALHOU:");
  for (const f of falhas) console.error(" - " + f);
  process.exit(1);
}
console.log("OK: tamanhos, duplicatas, respostas contidas nas válidas e COFRE ausente.");
