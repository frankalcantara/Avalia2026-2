/**
 * Baralho do jogo: pares conceituais "código JavaScript" <-> "saída".
 * Fica só no servidor. O cliente recebe apenas IDs opacos (UUID aleatório)
 * e o conteúdo de uma carta só é revelado quando ela é virada (/api/game/flip).
 */
const POOL = [
  ["2 + 3", "5"],
  ['"5" + 3', '"53"'],
  ["[1, 2, 3].length", "3"],
  ["typeof null", '"object"'],
  ['"abc".toUpperCase()', '"ABC"'],
  ["[3, 1, 2].sort()[0]", "1"],
  ["Math.max(4, 9, 2)", "9"],
  ["10 % 4", "2"],
  ['!!"0"', "true"],
  ['[..."hi"].reverse().join("")', '"ih"'],
  ["0.1 + 0.2 === 0.3", "false"],
];

export const PAIRS_PER_GAME = 8;

function randomInt(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

export function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Sorteia os pares e devolve as cartas já embaralhadas. */
export function buildDeck() {
  const chosen = shuffle(POOL).slice(0, PAIRS_PER_GAME);
  const cards = [];
  chosen.forEach(([code, out], index) => {
    const pairKey = crypto.randomUUID();
    cards.push({ cardId: crypto.randomUUID(), pairKey, kind: "code", content: code, index });
    cards.push({ cardId: crypto.randomUUID(), pairKey, kind: "output", content: out, index });
  });
  return shuffle(cards);
}
