// Validação da API (plano do Agente 3). Roda contra o servidor local (wrangler pages dev) e o D1 LOCAL.
// Uso, na pasta do projeto:  node tests\validar-api.mjs
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BASE = process.env.BASE || "http://localhost:8788";
const DB = "db-p26-2c-b0e6-32e6-33bf-f8f5";
const DAY = 864e5, H = 18e5; // H = 30 min
const secret = (readFileSync(".dev.vars", "utf8").match(/^SESSION_SECRET=(.+)$/m) || [])[1]?.trim();
if (!secret) { console.error("SESSION_SECRET não encontrado em .dev.vars"); process.exit(2); }

const U = { mon1: "teste-monitor", mon2: "teste-monitor2", stu1: "teste-aluno", stu2: "teste-aluno2" };
const sign = (uid) => {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 36e5 })).toString("base64url");
  return body + "." + createHmac("sha256", secret).update(body).digest("base64url");
};
const cookie = Object.fromEntries(Object.entries(U).map(([k, v]) => [k, "discord_session=" + sign(v)]));

function d1(sql, json = false) {
  writeFileSync(".tmp-validar.sql", sql);
  const win = process.platform === "win32";
  const tail = `wrangler d1 execute ${DB} --local --file=.tmp-validar.sql${json ? " --json" : ""}`;
  const r = win
    ? spawnSync(`npx.cmd ${tail}`, { encoding: "utf8", shell: true })
    : spawnSync("npx", tail.split(" "), { encoding: "utf8" });
  try { unlinkSync(".tmp-validar.sql"); } catch {}
  if (r.status !== 0) throw new Error("d1 falhou: " + (r.stderr || r.stdout).slice(0, 300));
  return r.stdout;
}
function rows(sql) {
  const out = d1(sql, true);
  const j = JSON.parse(out.slice(out.search(/^\[/m)));
  return j[j.length - 1].results || [];
}
const resetBookings = () => d1("DELETE FROM bookings WHERE student_id LIKE 'teste-%';");
const resetAll = () => d1("DELETE FROM bookings WHERE student_id LIKE 'teste-%' OR slot_id IN (SELECT id FROM slots WHERE monitor_id LIKE 'teste-%'); DELETE FROM slots WHERE monitor_id LIKE 'teste-%';");

async function call(who, method, path, body, opts = {}) {
  const headers = { Connection: "close" };
  if (who) headers.Cookie = cookie[who];
  if (method !== "GET" && opts.origin !== null) headers.Origin = opts.origin ?? BASE;
  let payload;
  if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = typeof body === "string" ? body : JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers, body: payload });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

const R = [];
async function t(id, teste, fn, expected) {
  let r; try { r = await fn(); } catch (e) { r = { status: "ERRO", body: String(e.message) }; }
  const exp = [].concat(expected), ok = exp.includes(r.status);
  R.push({ id, teste, esperado: exp.join("/"), obtido: String(r.status), resultado: ok ? "OK" : "FALHA" });
  if (!ok) console.log("   detalhe", id, JSON.stringify(r.body).slice(0, 160));
  return r;
}
function chk(id, teste, cond, obtido = "") {
  R.push({ id, teste, esperado: "verdadeiro", obtido: String(obtido), resultado: cond ? "OK" : "FALHA" });
}
const safe = (fn, fb) => { try { return fn(); } catch (e) { console.log("   aviso:", e.message); return fb; } };
const listSlots = async (who, from, len = DAY) => (await call(who, "GET", `/api/slots?from=${from}&to=${from + len}`)).body.slots || [];
const idsOf = (S, uid) => S.filter((s) => s.monitor.id === uid).sort((a, b) => a.start - b.start).map((s) => s.id);
const book = (who, id, topic = "Dúvida de teste") => call(who, "POST", "/api/bookings", { slot_id: id, topic });
const myBookings = async (who) => (await call(who, "GET", "/api/bookings")).body.bookings || [];

// ---------- preparação ----------
try { await fetch(BASE + "/api/me"); } catch {
  console.error(`Servidor não responde em ${BASE}. Rode 'npx.cmd wrangler pages dev' em outra janela.`); process.exit(2);
}
console.log("Preparando o banco local...");
d1(`INSERT OR IGNORE INTO discord_users (user_id, username) VALUES ('teste-monitor','Monitor Teste'),('teste-monitor2','Monitor Teste 2'),('teste-aluno','Aluno Teste'),('teste-aluno2','Aluno Teste 2');`);
resetAll();
const T = Math.ceil((Date.now() + 2 * DAY) / H) * H;

// ---------- Bloco 1: sem login e Origin ----------
console.log("Bloco 1: sem login e Origin");
await t("1.1", "GET slots sem login", () => call(null, "GET", `/api/slots?from=1&to=2`), 401);
await t("1.2", "GET bookings sem login", () => call(null, "GET", "/api/bookings"), 401);
await t("1.3", "POST bookings sem login (Origin certo)", () => call(null, "POST", "/api/bookings", { slot_id: 1, topic: "abc" }), 401);
await t("1.4", "DELETE bookings sem login", () => call(null, "DELETE", "/api/bookings/1"), 401);
await t("1.5", "DELETE slots sem login", () => call(null, "DELETE", "/api/slots/1"), 401);
await t("1.6", "POST sem header Origin", () => call(null, "POST", "/api/slots", { start: 1, end: 2 }, { origin: null }), 403);
await t("1.7", "POST logado com Origin de outro site", () => call("stu1", "POST", "/api/bookings", { slot_id: 1, topic: "abc" }, { origin: "https://evil.example" }), 403);
await t("1.8", "PUT em /api/slots/1", () => call("stu1", "PUT", "/api/slots/1", {}), [404, 405]);

// ---------- Bloco 2: criação de slots ----------
console.log("Bloco 2: criação de slots");
let r = await t("2.1", "criar 4 horários", () => call("mon1", "POST", "/api/slots", { start: T, end: T + 4 * H }), 201);
chk("2.1b", "created=4 e requested=4", r.body.created === 4 && r.body.requested === 4, JSON.stringify(r.body));
r = await t("2.2", "repetir a mesma janela", () => call("mon1", "POST", "/api/slots", { start: T, end: T + 4 * H }), 201);
chk("2.2b", "created=0 (idempotente)", r.body.created === 0, JSON.stringify(r.body));
await t("2.3", "datas em texto", () => call("mon1", "POST", "/api/slots", { start: "a", end: "b" }), 400);
await t("2.4", "início não inteiro", () => call("mon1", "POST", "/api/slots", { start: T + 0.5, end: T + H }), 400);
await t("2.5", "fora de múltiplos de 30 min", () => call("mon1", "POST", "/api/slots", { start: T + 1000, end: T + H + 1000 }), 400);
await t("2.6", "fim igual ao início", () => call("mon1", "POST", "/api/slots", { start: T + 10 * H, end: T + 10 * H }), 400);
await t("2.7", "janela maior que 8 h", () => call("mon1", "POST", "/api/slots", { start: T, end: T + 17 * H }), 400);
const past = Math.floor((Date.now() - DAY) / H) * H;
await t("2.8", "janela no passado", () => call("mon1", "POST", "/api/slots", { start: past, end: past + H }), 400);
await t("2.9", "mais de 60 dias de antecedência", () => call("mon1", "POST", "/api/slots", { start: T + 61 * DAY, end: T + 61 * DAY + H }), 400);
await t("2.10", "JSON quebrado", () => call("mon1", "POST", "/api/slots", "{oops"), 400);
await t("2.11", "JSON é um array", () => call("mon1", "POST", "/api/slots", "[1,2]"), 400);
await t("2.12", "corpo maior que 4 KB", () => call("mon1", "POST", "/api/slots", JSON.stringify({ start: T, end: T + H, x: "a".repeat(5000) })), 413);
await t("2.13", "intervalo de listagem vazio", () => call("mon1", "GET", `/api/slots?from=${T}&to=${T}`), 400);
await t("2.14", "intervalo de listagem maior que 8 dias", () => call("mon1", "GET", `/api/slots?from=${T}&to=${T + 9 * DAY}`), 400);

// ---------- Bloco 3: reservas e privacidade ----------
console.log("Bloco 3: reservas e privacidade");
const S = await listSlots("stu1", T);
const m1 = idsOf(S, U.mon1);
chk("3.0", "4 horários do monitor 1 visíveis ao aluno", m1.length === 4, m1.length);
await t("3.1", "slot_id em texto", () => call("stu1", "POST", "/api/bookings", { slot_id: "1", topic: "Duvida" }), 400);
await t("3.2", "tema curto (2 caracteres)", () => book("stu1", m1[0], "ab"), 400);
await t("3.3", "tema longo (301 caracteres)", () => book("stu1", m1[0], "x".repeat(301)), 400);
await t("3.4", "tema só com espaços", () => book("stu1", m1[0], "     "), 400);
await t("3.5", "tema numérico", () => call("stu1", "POST", "/api/bookings", { slot_id: m1[0], topic: 12345 }), 400);
await t("3.6", "slot inexistente", () => book("stu1", 999999999), 404);
await t("3.7", "monitor reserva o próprio horário", () => book("mon1", m1[0]), 403);
await t("3.8", "JSON null", () => call("stu1", "POST", "/api/bookings", "null"), 400);
r = await t("3.9", "reserva válida", () => book("stu1", m1[0], "Dúvida de cálculo"), 201);
await t("3.10", "mesma reserva de novo", () => book("stu1", m1[0], "Dúvida de cálculo"), 409);
chk("3.11", "aluno vê a própria reserva em /api/bookings", (await myBookings("stu1")).length === 1);
const asStu2 = (await listSlots("stu2", T)).find((s) => s.id === m1[0]);
chk("3.12", "outro aluno vê o horário ocupado sem tema, nome nem id da reserva", asStu2.booked === true && asStu2.topic === null && asStu2.student === null && asStu2.booking_id === null, JSON.stringify({ topic: asStu2.topic, student: asStu2.student }));
const asMon = (await listSlots("mon1", T)).find((s) => s.id === m1[0]);
chk("3.13", "monitor vê tema e nome do aluno", !!asMon.topic && !!asMon.student, asMon.student);

// ---------- Bloco 4: corrida ----------
console.log("Bloco 4: corrida (2 alunos diferentes, 12 requisições simultâneas)");
resetBookings();
const race = await Promise.all(Array.from({ length: 12 }, (_, i) => book(i % 2 ? "stu1" : "stu2", m1[1], "Corrida " + i)));
const codes = race.map((x) => x.status).sort();
chk("4.1", "exatamente 1 × 201 e 11 × 409", codes.filter((c) => c === 201).length === 1 && codes.filter((c) => c === 409).length === 11, codes.join(","));
chk("4.2", "banco sem reserva duplicada", safe(() => rows("SELECT slot_id, COUNT(*) AS n FROM bookings GROUP BY slot_id HAVING n > 1").length === 0, false));
chk("4.3", "UNIQUE(slot_id) existe na tabela bookings", safe(() => /UNIQUE/i.test(rows("SELECT sql FROM sqlite_master WHERE name='bookings'")[0].sql), false));

// ---------- Bloco 5: sobreposição ----------
console.log("Bloco 5: sobreposição");
resetBookings();
await call("mon2", "POST", "/api/slots", { start: T, end: T + H });
const m2 = idsOf(await listSlots("stu1", T), U.mon2);
await t("5.1", "primeira reserva (T)", () => book("stu1", m1[0]), 201);
await t("5.2", "mesmo horário com outro monitor", () => book("stu1", m2[0]), 409);
await t("5.3", "horário adjacente (T+30min)", () => book("stu1", m1[1]), 201);

// ---------- Bloco 6: cancelamento e autoria ----------
console.log("Bloco 6: cancelamento e autoria");
resetBookings();
await book("stu1", m1[2], "Para cancelar");
let bk = (await myBookings("stu1"))[0]?.id;
await t("6.1", "terceiro (monitor 2) cancela reserva alheia", () => call("mon2", "DELETE", "/api/bookings/" + bk), 403);
await t("6.2", "aluno cancela a própria reserva", () => call("stu1", "DELETE", "/api/bookings/" + bk), 204);
await t("6.3", "cancelar de novo", () => call("stu1", "DELETE", "/api/bookings/" + bk), 404);
await book("stu1", m1[2], "Recriada");
bk = (await myBookings("stu1"))[0]?.id;
await t("6.4", "monitor do horário cancela a reserva", () => call("mon1", "DELETE", "/api/bookings/" + bk), 204);
await t("6.5", "reserva inexistente", () => call("stu1", "DELETE", "/api/bookings/999999999"), 404);
await t("6.6", "id de reserva inválido (abc)", () => call("stu1", "DELETE", "/api/bookings/abc"), [400, 404]);
await t("6.7", "id de horário inválido (abc)", () => call("mon1", "DELETE", "/api/slots/abc"), [400, 404]);

// ---------- Bloco 7: remoção de slot ----------
console.log("Bloco 7: remoção de slot");
resetBookings();
await book("stu1", m1[0], "Slot ocupado");
await t("7.1", "monitor remove horário com aluno agendado", () => call("mon1", "DELETE", "/api/slots/" + m1[0]), 409);
await t("7.2", "aluno remove horário do monitor", () => call("stu2", "DELETE", "/api/slots/" + m1[3]), 403);
await t("7.3", "monitor remove horário livre", () => call("mon1", "DELETE", "/api/slots/" + m1[3]), 204);
await t("7.4", "horário inexistente", () => call("mon1", "DELETE", "/api/slots/999999999"), 404);
bk = (await myBookings("stu1"))[0]?.id;
await call("stu1", "DELETE", "/api/bookings/" + bk);
await t("7.5", "remove o horário depois do cancelamento", () => call("mon1", "DELETE", "/api/slots/" + m1[0]), 204);

// ---------- Bloco 8: limite de 10 reservas ----------
console.log("Bloco 8: limite de 10 reservas futuras");
resetAll();
const T2 = T + 3 * DAY;
r = await t("8.1", "monitor abre 16 horários", () => call("mon1", "POST", "/api/slots", { start: T2, end: T2 + 16 * H }), 201);
const L = idsOf(await listSlots("stu2", T2), U.mon1);
const seq = []; for (let i = 0; i < 11; i++) seq.push((await book("stu2", L[i], "Limite " + i)).status);
chk("8.2", "10 × 201 e depois 409 (11ª reserva)", seq.slice(0, 10).every((c) => c === 201) && seq[10] === 409, seq.join(","));
chk("8.3", "aluno tem exatamente 10 reservas", (await myBookings("stu2")).length === 10);
const first = (await myBookings("stu2"))[0].id;
await call("stu2", "DELETE", "/api/bookings/" + first);
await t("8.4", "após cancelar 1, a 11ª reserva passa", () => book("stu2", L[10], "Depois de cancelar"), 201);
resetBookings();
const par = (await Promise.all(L.slice(0, 12).map((id) => book("stu2", id, "Paralelo")))).map((x) => x.status).sort();
chk("8.5", "12 simultâneas: exatamente 10 × 201 e 2 × 409", par.filter((c) => c === 201).length === 10 && par.filter((c) => c === 409).length === 2, par.join(","));

// ---------- Bloco 9: horários passados ----------
console.log("Bloco 9: horários passados");
resetAll();
safe(() => {
  d1("INSERT INTO slots (monitor_id, start_ts, end_ts) VALUES ('teste-monitor', 1700000000000, 1700001800000);");
  const pid = rows("SELECT id FROM slots WHERE start_ts = 1700000000000 AND monitor_id = 'teste-monitor'")[0].id;
  return pid;
}, null);
const pid = safe(() => rows("SELECT id FROM slots WHERE start_ts = 1700000000000 AND monitor_id = 'teste-monitor'")[0].id, null);
if (pid) {
  await t("9.1", "reservar horário que já passou", () => book("stu1", pid), 400);
  safe(() => d1(`INSERT INTO bookings (slot_id, student_id, topic, created_at) VALUES (${pid}, 'teste-aluno', 'teste', 1700000000000);`));
  const pb = safe(() => rows(`SELECT id FROM bookings WHERE slot_id = ${pid}`)[0].id, null);
  await t("9.2", "cancelar reserva de horário que já começou", () => call("stu1", "DELETE", "/api/bookings/" + pb), 400);
  chk("9.3", "reserva passada não aparece em /api/bookings", !(await myBookings("stu1")).some((b) => b.id === pb));
} else chk("9.0", "preparar horário passado no banco", false, "não foi possível semear");

// ---------- Bloco 10: limite de 200 slots ----------
console.log("Bloco 10: limite de 200 horários por monitor");
resetAll();
let total = 0, allOk = true;
for (let i = 0; i < 14; i++) {
  const s = T + 10 * DAY + i * DAY;
  const x = await call("mon2", "POST", "/api/slots", { start: s, end: s + 16 * H });
  if (x.status !== 201) allOk = false; total += x.body.created || 0;
}
chk("10.1", "14 janelas de 16 horários, todas com 201", allOk);
chk("10.2", "total criado = 200 (e não 224)", total === 200, total);
chk("10.3", "banco confirma 200 horários futuros do monitor", safe(() => rows("SELECT COUNT(*) AS n FROM slots WHERE monitor_id = 'teste-monitor2'")[0].n === 200, false));

// ---------- Bloco 11: robustez ----------
console.log("Bloco 11: robustez");
resetAll();
await call("mon1", "POST", "/api/slots", { start: T, end: T + H });
const x1 = idsOf(await listSlots("stu1", T), U.mon1)[0];
const xss = "<img src=x onerror=alert(1)>";
await t("11.1", "tema com HTML é aceito como texto", () => book("stu1", x1, xss), 201);
chk("11.2", "a API devolve o tema sem alterar (o front usa textContent)", (await myBookings("stu1"))[0]?.topic === xss);
await t("11.3", "PATCH em /api/slots/1", () => call("stu1", "PATCH", "/api/slots/1", {}), [404, 405]);

// ---------- relatório ----------
function report() {
try { resetAll(); } catch {}
console.log("\n");
console.table(R.map(({ id, teste, esperado, obtido, resultado }) => ({ id, teste: teste.slice(0, 60), esperado, obtido: obtido.slice(0, 30), resultado })));
const falhas = R.filter((x) => x.resultado !== "OK");
console.log(`\nTOTAL: ${R.length} testes, ${R.length - falhas.length} OK, ${falhas.length} FALHA`);
if (falhas.length) console.log("Falhas:", falhas.map((f) => f.id).join(", "));
const md = ["# Resultado da validação da API", "", `Executado em ${new Date().toISOString()} contra ${BASE} (D1 local).`, "",
  "| ID | Teste | Esperado | Obtido | Resultado |", "|---|---|---|---|---|",
  ...R.map((x) => `| ${x.id} | ${x.teste} | ${x.esperado} | ${x.obtido.replace(/\|/g, "/")} | ${x.resultado} |`),
  "", `**Total:** ${R.length} testes, ${R.length - falhas.length} OK, ${falhas.length} FALHA.`].join("\n");
writeFileSync("tests/resultado-validacao.md", md);
console.log("Tabela salva em tests\\resultado-validacao.md");
return falhas.length;
}

process.on("uncaughtException", (e) => {
  console.error("\nScript interrompido:", e.message, e.cause ? "(" + (e.cause.code || e.cause.message) + ")" : "");
  report();
  process.exit(1);
});
process.exit(report() ? 1 : 0);
