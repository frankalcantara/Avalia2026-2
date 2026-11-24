/**
 * Banco de pares codigo <-> saida. Fica SO no servidor.
 * Cada par tem uma chave (key), o codigo e a saida esperada.
 */
export const PAIRS = [
  { key: "js-len",    code: "console.log([1,2,3].length)",            output: "3" },
  { key: "js-typeof", code: "console.log(typeof null)",               output: "object" },
  { key: "js-concat", code: "console.log('5' + 3)",                   output: "53" },
  { key: "js-minus",  code: "console.log('5' - 3)",                   output: "2" },
  { key: "js-bool",   code: "console.log(0 === false)",               output: "false" },
  { key: "js-map",    code: "console.log([1,2,3].map(x => x * 2))",   output: "[ 2, 4, 6 ]" },
  { key: "js-upper",  code: "console.log('abc'.toUpperCase())",       output: "ABC" },
  { key: "js-slice",  code: "console.log('hello'.slice(1, 3))",       output: "el" },
  { key: "js-nan",    code: "console.log(0.1 + 0.2 === 0.3)",         output: "false" },
  { key: "js-join",   code: "console.log(['a','b','c'].join('-'))",   output: "a-b-c" },
  { key: "js-rev",    code: "console.log([1,2,3].reverse())",         output: "[ 3, 2, 1 ]" },
  { key: "js-math",   code: "console.log(Math.max(4, 9, 2))",         output: "9" },
];

export const PAIRS_PER_GAME = 6;