export const SHIPS = { "Porta-aviões": 5, "Encouraçado": 4, "Cruzador": 3, "Submarino": 3, "Destroyer": 2 };
export const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
export const cellsOf = (s) => Array.from({ length: SHIPS[s.name] }, (_, i) => [s.r + (s.o === "V" ? i : 0), s.c + (s.o === "H" ? i : 0)]);
const keys = (shots) => new Set(shots.map(([a, b]) => a * 10 + b));

export async function getUser(req, env) {
  const m = (req.headers.get("Cookie") || "").match(/(?:^|; )sid=([\w-]+)/);
  if (!m) return null;
  return env.DB.prepare("SELECT u.discord_id, u.username, u.avatar FROM sessions s JOIN users u ON u.discord_id = s.discord_id WHERE s.id = ? AND s.expires_at > ?")
    .bind(m[1], Date.now()).first();
}

export function validFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== 5) return false;
  const names = new Set(), used = new Set();
  for (const s of ships) {
    if (!s || !Object.hasOwn(SHIPS, s.name) || names.has(s.name)) return false;
    if (!Number.isInteger(s.r) || !Number.isInteger(s.c) || !["H", "V"].includes(s.o)) return false;
    names.add(s.name);
    for (const [r, c] of cellsOf(s)) {
      if (r < 0 || r > 9 || c < 0 || c > 9 || used.has(r * 10 + c)) return false;
      used.add(r * 10 + c);
    }
  }
  return true;
}

export function randomFleet() {
  const used = new Set(), fleet = [];
  for (const name of Object.keys(SHIPS)) {
    for (;;) {
      const s = { name, r: Math.floor(Math.random() * 10), c: Math.floor(Math.random() * 10), o: Math.random() < 0.5 ? "H" : "V" };
      const cs = cellsOf(s);
      if (cs.some(([r, c]) => r > 9 || c > 9 || used.has(r * 10 + c))) continue;
      cs.forEach(([r, c]) => used.add(r * 10 + c));
      fleet.push(s);
      break;
    }
  }
  return fleet;
}

export function shoot(fleet, shots, r, c) {
  const k = keys(shots); k.add(r * 10 + c);
  for (const s of fleet) {
    const cs = cellsOf(s);
    if (cs.some(([a, b]) => a === r && b === c)) {
      const sunk = cs.every(([a, b]) => k.has(a * 10 + b));
      return sunk ? { result: "afundado", ship: s.name } : { result: "acerto" };
    }
  }
  return { result: "agua" };
}

export function allSunk(fleet, shots) {
  const k = keys(shots);
  return fleet.every((s) => cellsOf(s).every(([a, b]) => k.has(a * 10 + b)));
}
