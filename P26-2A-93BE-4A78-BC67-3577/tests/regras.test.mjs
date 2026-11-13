// Testes das regras puras do jogo (sem rede, sem banco). Executar: node tests/regras.test.mjs
import { FLEET, BOARD_SIZE, cellsOf, validateFleet, randomFleet, resolveShot, pickCpuShot } from "../functions/_lib/game.js";

let ok = 0;
const falhas = [];
const t = (cond, nome) => (cond ? ok++ : falhas.push(nome));

const base = () => [
  { name: "porta-avioes", row: 0, col: 0, orientation: "H" },
  { name: "encouracado", row: 1, col: 0, orientation: "H" },
  { name: "cruzador", row: 2, col: 0, orientation: "H" },
  { name: "submarino", row: 3, col: 0, orientation: "V" },
  { name: "destroyer", row: 8, col: 8, orientation: "H" },
];
const erro = (mut) => validateFleet(mut(base())).error;

// --- Validação do posicionamento (o que o servidor aceita/recusa) ---
t(!validateFleet(base()).error, "frota válida é aceita");
t(validateFleet(base()).placed.length === 5, "5 navios posicionados");
t(erro((s) => { s[0].col = 8; return s; }), "porta-aviões fora do limite horizontal");
t(erro((s) => { s[3].row = 8; return s; }), "submarino fora do limite vertical");
t(erro((s) => { s[1].row = 0; return s; }), "sobreposição de navios");
t(erro((s) => s.slice(0, 4)), "frota incompleta");
t(erro((s) => [...s, s[0]]), "navio a mais");
t(erro((s) => { s[1].name = "porta-avioes"; return s; }), "navio duplicado");
t(erro((s) => { s[0].name = "jangada"; return s; }), "navio desconhecido");
t(erro((s) => { s[0].row = 1.5; return s; }), "coordenada não inteira");
t(erro((s) => { s[0].row = "0"; return s; }), "coordenada como texto");
t(erro((s) => { s[0].orientation = "X"; return s; }), "orientação inválida");
t(erro((s) => { s[0].row = -1; return s; }), "coordenada negativa");
t(validateFleet("lixo").error && validateFleet(null).error && validateFleet(undefined).error, "entrada que não é lista");
{ // o cliente não escolhe o tamanho: size enviado é ignorado
  const s = base(); s[4].size = 99;
  const r = validateFleet(s);
  t(!r.error && r.placed.find((p) => p.name === "destroyer").size === 2, "tamanho enviado pelo cliente é ignorado");
}

// --- Frota do computador ---
for (let i = 0; i < 300; i++) {
  const f = randomFleet();
  const cells = f.flatMap(cellsOf).map(([r, c]) => `${r},${c}`);
  t(f.length === FLEET.length && new Set(cells).size === 17, "frota aleatória tem 5 navios e 17 células distintas");
  t(f.flatMap(cellsOf).every(([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE), "frota aleatória dentro do tabuleiro");
}

// --- Resultado dos tiros ---
{
  const ships = [{ name: "destroyer", size: 2, row: 4, col: 4, orientation: "H", hits: 0 }];
  t(resolveShot(ships, 0, 0).result === "agua", "tiro na água");
  t(resolveShot(ships, 4, 4).result === "acerto", "tiro que acerta");
  ships[0].hits = 1;
  t(resolveShot(ships, 4, 5).result === "afundado", "último acerto afunda o navio");
}

// --- Tiros do computador: nunca repete célula e sempre termina a partida em até 100 tiros ---
for (let g = 0; g < 200; g++) {
  const ships = randomFleet().map((s) => ({ ...s, hits: 0 }));
  const usados = new Set();
  let n = 0;
  while (!ships.every((s) => s.hits >= s.size) && n <= 100) {
    const p = pickCpuShot(usados, ships);
    if (!p) break;
    const k = `${p[0]},${p[1]}`;
    t(!usados.has(k), "computador repetiu um tiro");
    usados.add(k); n++;
    const r = resolveShot(ships, p[0], p[1]);
    if (r.ship) r.ship.hits++;
  }
  t(ships.every((s) => s.hits >= s.size) && n <= 100, "computador não terminou a partida");
}

console.log(`${ok} verificações OK, ${falhas.length} falhas`);
if (falhas.length) { console.log([...new Set(falhas)].join("\n")); process.exit(1); }
