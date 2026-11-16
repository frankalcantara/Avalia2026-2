// Tela de entrada: marca em peças, disco do cofre e tabuleiro de demonstração.
// A demonstração usa a palavra fixa COFRE, que não faz parte do sorteio diário.

import { el } from "./ui.js";

const DEMO_WORD = "COFRE";
const DEMO_GUESSES = ["PRATO", "CERCO", "COFRE"];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function demoFeedback(guess, answer) {
  const res = Array(5).fill("absent");
  const left = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) res[i] = "correct";
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] !== "correct" && left[guess[i]]) {
      res[i] = "present";
      left[guess[i]]--;
    }
  }
  return res;
}

export function renderWordmark(node) {
  const letters = "CYPHER";
  const states = ["correct", null, "present", null, null, "absent"];
  node.replaceChildren(
    ...[...letters].map((ch, i) => el("span", { class: `tile${states[i] ? ` tile--${states[i]}` : " tile--filled"}`, "aria-hidden": "true", text: ch }))
  );
}

export function renderDial(svgNode) {
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  svgNode.replaceChildren();
  svgNode.append(mk("circle", { cx: 200, cy: 200, r: 196, class: "dial-ring" }));
  const rotor = mk("g", { class: "dial-rotor" });
  rotor.append(mk("circle", { cx: 200, cy: 200, r: 178, class: "dial-ring" }));
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    const r1 = major ? 158 : 166;
    const r2 = 176;
    rotor.append(mk("line", {
      x1: 200 + Math.sin(a) * r1, y1: 200 - Math.cos(a) * r1,
      x2: 200 + Math.sin(a) * r2, y2: 200 - Math.cos(a) * r2,
      class: `dial-tick${major ? " dial-tick--major" : ""}`,
    }));
  }
  svgNode.append(rotor);
  svgNode.append(mk("path", { d: "M192 0 L208 0 L200 14 Z", class: "dial-notch" }));
}

export function startDemo(boardNode, vaultNode) {
  let alive = true;
  const rows = [];
  boardNode.replaceChildren();
  for (let r = 0; r < 4; r++) {
    const row = el("div", { class: "row" });
    for (let c = 0; c < 5; c++) row.append(el("div", { class: "tile" }));
    boardNode.append(row);
    rows.push(row);
  }

  const paintRow = (r, guess, fb, animate) => {
    const tiles = [...rows[r].children];
    tiles.forEach((t, i) => {
      t.textContent = guess[i];
      const set = () => {
        t.className = `tile tile--${fb[i]}`;
      };
      if (animate) {
        t.className = "tile tile--filled tile--spin";
        t.style.animationDelay = `${i * 120}ms`;
        setTimeout(set, i * 120 + 150);
      } else set();
    });
  };

  if (reduced()) {
    DEMO_GUESSES.forEach((g, r) => paintRow(r, g, demoFeedback(g, DEMO_WORD), false));
    vaultNode.classList.add("is-open");
    return () => {};
  }

  (async () => {
    while (alive) {
      vaultNode.classList.remove("is-open");
      rows.forEach((row) => [...row.children].forEach((t) => { t.className = "tile"; t.textContent = ""; t.style.animationDelay = ""; }));
      await wait(700);
      for (let r = 0; r < DEMO_GUESSES.length && alive; r++) {
        const g = DEMO_GUESSES[r];
        const tiles = [...rows[r].children];
        for (let i = 0; i < 5 && alive; i++) {
          tiles[i].textContent = g[i];
          tiles[i].className = "tile tile--filled";
          await wait(110);
        }
        await wait(250);
        paintRow(r, g, demoFeedback(g, DEMO_WORD), true);
        await wait(5 * 120 + 500);
      }
      if (!alive) break;
      vaultNode.classList.add("is-open");
      await wait(3200);
    }
  })();

  return () => {
    alive = false;
  };
}
