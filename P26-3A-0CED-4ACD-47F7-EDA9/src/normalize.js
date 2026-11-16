// Remove acentos e cedilha, coloca em caixa alta e exige 5 letras A-Z
import { WORD_LENGTH } from "./config.js";

const PATTERN = new RegExp(`^[A-Z]{${WORD_LENGTH}}$`);

export function normalizeWord(input) {
  if (typeof input !== "string") return null;
  const key = input.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  return PATTERN.test(key) ? key : null;
}
