// Dicionário em memória (construído uma vez por isolate)
import { ANSWERS } from "./data/answers.js";
import { VALID } from "./data/valid.js";
import { normalizeWord } from "./normalize.js";

let cache = null;

function build() {
  const display = new Map();
  const answerKeys = [];
  for (const word of ANSWERS) {
    const key = normalizeWord(word);
    if (key && !display.has(key)) {
      display.set(key, word.toUpperCase());
      answerKeys.push(key);
    }
  }
  const valid = new Set();
  for (const w of VALID.split(/\s+/)) {
    const key = normalizeWord(w);
    if (key) valid.add(key);
  }
  for (const key of answerKeys) valid.add(key);
  return { display, answerKeys, valid };
}

function dict() {
  if (!cache) cache = build();
  return cache;
}

export const isValidWord = (key) => dict().valid.has(key);
export const displayOf = (key) => dict().display.get(key) || key;
export const answerKeys = () => dict().answerKeys;
