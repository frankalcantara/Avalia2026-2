/**
 * Regras puras do jogo (sem acesso ao banco): frota, validação de posicionamento
 * e sorteio da frota do computador. Tudo é validado aqui no servidor.
 */
export const BOARD_SIZE = 10;

export const FLEET = [
  { key: "porta-avioes", label: "Porta-aviões", size: 5 },
  { key: "encouracado", label: "Encouraçado", size: 4 },
  { key: "cruzador", label: "Cruzador", size: 3 },
  { key: "submarino", label: "Submarino", size: 3 },
  { key: "destroyer", label: "Destroyer", size: 2 },
];

// Células [linha, coluna] ocupadas por um navio.
export function cellsOf(ship) {
  const cells = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push(ship.orientation === "H" ? [ship.row, ship.col + i] : [ship.row + i, ship.col]);
  }
  return cells;
}

const inBoard = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

// Valida a frota enviada pelo cliente. O tamanho de cada navio vem do servidor (FLEET),
// nunca do cliente. Devolve { error } ou { placed }.
export function validateFleet(input) {
  if (!Array.isArray(input) || input.length !== FLEET.length) {
    return { error: `Envie exatamente ${FLEET.length} navios.` };
  }
  const placed = [];
  const taken = new Set();
  const seen = new Set();

  for (const item of input) {
    const spec = FLEET.find((f) => f.key === item?.name);
    if (!spec) return { error: "Navio desconhecido." };
    if (seen.has(spec.key)) return { error: `Navio repetido: ${spec.label}.` };
    seen.add(spec.key);

    const { row, col, orientation } = item;
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return { error: `Coordenadas de ${spec.label} devem ser números inteiros.` };
    }
    if (orientation !== "H" && orientation !== "V") {
      return { error: `Orientação de ${spec.label} deve ser H ou V.` };
    }

    const ship = { name: spec.key, size: spec.size, row, col, orientation };
    for (const [r, c] of cellsOf(ship)) {
      if (!inBoard(r, c)) return { error: `${spec.label} sai dos limites do tabuleiro.` };
      const k = r * BOARD_SIZE + c;
      if (taken.has(k)) return { error: `${spec.label} sobrepõe outro navio.` };
      taken.add(k);
    }
    placed.push(ship);
  }
  return { placed };
}

const randInt = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

// Sorteia a frota do computador (sem sobreposição, sempre dentro do tabuleiro).
export function randomFleet() {
  const placed = [];
  const taken = new Set();
  for (const spec of FLEET) {
    let ok = false;
    for (let attempt = 0; attempt < 1000 && !ok; attempt++) {
      const orientation = randInt(2) === 0 ? "H" : "V";
      const row = randInt(orientation === "V" ? BOARD_SIZE - spec.size + 1 : BOARD_SIZE);
      const col = randInt(orientation === "H" ? BOARD_SIZE - spec.size + 1 : BOARD_SIZE);
      const ship = { name: spec.key, size: spec.size, row, col, orientation };
      const keys = cellsOf(ship).map(([r, c]) => r * BOARD_SIZE + c);
      if (keys.some((k) => taken.has(k))) continue;
      keys.forEach((k) => taken.add(k));
      placed.push(ship);
      ok = true;
    }
    if (!ok) throw new Error("Não foi possível sortear a frota do computador.");
  }
  return placed;
}

// Navio (da lista recebida) que ocupa a célula, ou null.
export function shipAt(ships, row, col) {
  return ships.find((s) => cellsOf(s).some(([r, c]) => r === row && c === col)) || null;
}

/**
 * Resolve um tiro contra uma lista de navios (cada um com hits e size).
 * NÃO altera nada: devolve o resultado e o navio atingido (ou null).
 */
export function resolveShot(ships, row, col) {
  const ship = shipAt(ships, row, col);
  if (!ship) return { result: "agua", ship: null };
  return { result: ship.hits + 1 >= ship.size ? "afundado" : "acerto", ship };
}

/**
 * Escolhe o tiro do computador: se há acerto em navio ainda não afundado, tenta as
 * células vizinhas; senão, sorteia entre as células ainda não atiradas.
 * `taken` = Set "r,c" dos tiros do computador; `playerShips` = frota do jogador (com hits).
 */
export function pickCpuShot(taken, playerShips) {
  const free = (r, c) => inBoard(r, c) && !taken.has(`${r},${c}`);
  const pool = [];
  for (const ship of playerShips) {
    if (ship.hits <= 0 || ship.hits >= ship.size) continue;
    for (const [r, c] of cellsOf(ship)) {
      if (!taken.has(`${r},${c}`)) continue; // célula já atingida deste navio
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (free(r + dr, c + dc)) pool.push([r + dr, c + dc]);
      }
    }
  }
  if (!pool.length) {
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (free(r, c)) pool.push([r, c]);
  }
  if (!pool.length) return null;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return pool[buf[0] % pool.length];
}
