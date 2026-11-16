/* ---------- Tabuleiro com Ícones Visuais e Animação 3D ---------- */
function createCard(token) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "memory-card";
  btn.setAttribute("aria-label", "Carta virada para baixo");

  const inner = document.createElement("span");
  inner.className = "memory-inner";

  const back = document.createElement("span");
  back.className = "memory-face memory-back";
  // O verso exibe o ícone elétrico estilizado via CSS

  const front = document.createElement("span");
  front.className = "memory-face memory-front";

  // Ícone ilustrativo dinâmico para a carta
  const icon = document.createElement("div");
  icon.className = "card-visual-icon";
  icon.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;

  const kind = document.createElement("small");
  kind.className = "memory-kind";
  
  const text = document.createElement("code");
  text.className = "memory-text";

  front.append(icon, kind, text);
  inner.append(back, front);
  btn.append(inner);
  
  btn.addEventListener("click", () => onCardClick(token));
  return btn;
}

function reveal(face) {
  const entry = state.game.cards.get(face.token);
  const el = entry.el;
  const isCode = face.kind === "code";
  const label = isCode ? "CÓDIGO JS" : "SAÍDA / OUTPUT";

  el.dataset.kind = face.kind;
  el.querySelector(".memory-kind").textContent = label;
  el.querySelector(".memory-text").textContent = face.text;

  // Altera o ícone visual dependendo se é Código ou Saída
  const iconContainer = el.querySelector(".card-visual-icon");
  if (isCode) {
    iconContainer.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #00f0ff;"><path d="M16 18l6-6-6-6"></path><path d="M8 6l-6 6 6 6"></path></svg>`;
  } else {
    iconContainer.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ff007f;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
  }

  el.setAttribute("aria-label", label + ": " + face.text);
  el.classList.add("flipped");
}
