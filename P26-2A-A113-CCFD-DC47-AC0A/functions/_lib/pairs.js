// Banco de pares do tema "código JavaScript e sua saída". Só existe no servidor.
export const PAIRS = [
  { code: '2 + "2"', output: '"22"' },
  { code: "typeof null", output: '"object"' },
  { code: "[1, 2, 3].length", output: "3" },
  { code: '"abc".toUpperCase()', output: '"ABC"' },
  { code: "Math.max(4, 9, 2)", output: "9" },
  { code: '[..."oi"].reverse().join("")', output: '"io"' },
  { code: "0.1 + 0.2 === 0.3", output: "false" },
  { code: 'parseInt("42px")', output: "42" },
  { code: "[1, 2, 3].map(n => n * 2)", output: "[2, 4, 6]" },
  { code: '"5" - 2', output: "3" },
  { code: 'Boolean("")', output: "false" },
  { code: "[10, 1, 3].sort()", output: "[1, 10, 3]" },
];

export const PAIRS_PER_GAME = 8;
