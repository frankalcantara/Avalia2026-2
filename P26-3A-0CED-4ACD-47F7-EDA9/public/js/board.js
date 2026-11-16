// Tabuleiro e teclado virtual, montados com manipulação direta do DOM

import { el, ICONS } from "./ui.js";

const STEP = 130; // atraso entre peças na revelação (ms)
const HALF = 150; // metade do giro: momento em que a cor aparece
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const STATE_LABEL = { correct: "letra certa no lugar certo", present: "letra existe em outro lugar", absent: "letra não existe" };

export class Board {
  constructor(root, { rows, mode, length = 5 }) {
    this.root = root;
    this.rows = rows;
    this.mode = mode;
    this.length = length;
    this.rowEls = [];
    root.replaceChildren();
    root.dataset.mode = mode;
    root.style.setProperty("--rows", rows);
    for (let r = 0; r < rows; r++) {
      const row = el("div", { class: "row row--empty", role: "row", "aria-label": `Tentativa ${r + 1}` });
      for (let c = 0; c < length; c++) row.append(el("div", { class: "tile", role: "gridcell", "aria-label": "vazio" }));
      if (mode === "sombra") {
        row.append(
          el("div", { class: "clue", "aria-hidden": "true" },
            el("span", { class: "clue--exact", title: "Letras no lugar certo", text: "·" }),
            el("span", { class: "clue--misplaced", title: "Letras no lugar errado", text: "·" }))
        );
      }
      root.append(row);
      this.rowEls.push(row);
    }
  }

  tiles(r) {
    return [...this.rowEls[r].querySelectorAll(".tile")];
  }

  setLetters(r, letters) {
    if (!this.rowEls[r]) return;
    const row = this.rowEls[r];
    this.tiles(r).forEach((tile, i) => {
      const ch = letters[i] || "";
      if (tile.textContent !== ch) {
        tile.textContent = ch;
        tile.classList.toggle("tile--filled", Boolean(ch));
        tile.setAttribute("aria-label", ch || "vazio");
      }
    });
    row.classList.toggle("row--empty", !letters.length);
  }

  async applyRow(r, guess, feedback, { animate = true } = {}) {
    const row = this.rowEls[r];
    if (!row) return;
    const tiles = this.tiles(r);
    const letters = guess.split("");
    this.setLetters(r, letters);
    const motion = animate && !reduced();

    tiles.forEach((tile, i) => {
      const paint = () => {
        if (this.mode !== "sombra") {
          const state = feedback[i];
          tile.classList.remove("tile--filled");
          tile.classList.add(`tile--${state}`);
          tile.setAttribute("aria-label", `${letters[i]}, ${STATE_LABEL[state]}`);
        } else {
          tile.classList.remove("tile--filled");
          tile.classList.add("tile--ghost");
        }
      };
      if (motion) {
        tile.style.animationDelay = `${i * STEP}ms`;
        tile.classList.add("tile--spin");
        setTimeout(paint, i * STEP + HALF);
        tile.addEventListener("animationend", () => {
          tile.classList.remove("tile--spin");
          tile.style.animationDelay = "";
        }, { once: true });
      } else {
        paint();
      }
    });

    if (motion) await wait((tiles.length - 1) * STEP + 2 * HALF + 40);

    if (this.mode === "sombra") {
      const clue = row.querySelector(".clue");
      const [ex, mis] = clue.children;
      ex.textContent = feedback.exact;
      mis.textContent = feedback.misplaced;
      ex.classList.toggle("is-on", feedback.exact > 0);
      mis.classList.toggle("is-on", feedback.misplaced > 0);
      ex.classList.toggle("is-zero", feedback.exact === 0);
      mis.classList.toggle("is-zero", feedback.misplaced === 0);
      clue.removeAttribute("aria-hidden");
      clue.setAttribute("aria-label", `${feedback.exact} no lugar certo, ${feedback.misplaced} no lugar errado`);
      if (motion) {
        clue.classList.add("clue--pop");
        await wait(260);
        clue.classList.remove("clue--pop");
      }
    }
  }

  shake(r) {
    const row = this.rowEls[r];
    if (!row) return;
    row.classList.remove("row--shake");
    void row.offsetWidth;
    row.classList.add("row--shake");
    row.addEventListener("animationend", () => row.classList.remove("row--shake"), { once: true });
  }
}

const LAYOUT = ["QWERTYUIOP", "ASDFGHJKL", "+ZXCVBNM-"];
const RANK = { absent: 1, present: 2, correct: 3 };

export class Keyboard {
  constructor(root, onKey) {
    this.root = root;
    this.keys = new Map();
    this.state = new Map();
    root.replaceChildren();
    for (const line of LAYOUT) {
      const row = el("div", { class: "keyboard__row" });
      for (const ch of line) {
        let key;
        if (ch === "+") {
          key = el("button", { type: "button", class: "key key--wide", "aria-label": "Enviar", text: "ENTER", onclick: () => onKey("Enter") });
        } else if (ch === "-") {
          key = el("button", { type: "button", class: "key key--wide", "aria-label": "Apagar", html: ICONS.apagar, onclick: () => onKey("Backspace") });
        } else {
          key = el("button", { type: "button", class: "key", text: ch, "aria-label": ch, onclick: () => onKey(ch) });
          this.keys.set(ch, key);
        }
        row.append(key);
      }
      root.append(row);
    }
  }

  reset() {
    this.state.clear();
    for (const key of this.keys.values()) key.classList.remove("key--correct", "key--present", "key--absent");
  }

  mark(guess, feedback) {
    [...guess].forEach((ch, i) => {
      const next = feedback[i];
      const prev = this.state.get(ch);
      if (!prev || RANK[next] > RANK[prev]) {
        this.state.set(ch, next);
        const key = this.keys.get(ch);
        if (key) {
          key.classList.remove("key--correct", "key--present", "key--absent");
          key.classList.add(`key--${next}`);
          key.setAttribute("aria-label", `${ch}, ${STATE_LABEL[next]}`);
        }
      }
    });
  }

  setDisabled(disabled) {
    this.root.classList.toggle("is-disabled", disabled);
  }
}
