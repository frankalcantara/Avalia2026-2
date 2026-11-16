// Utilidades de interface: criação de elementos, ícones, avisos e painel modal

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const P = (d) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  cofres: svg(`<rect x="3" y="4" width="18" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>${P("M3 9h18M8 2v4M16 2v4")}<circle cx="12" cy="15" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/>`),
  estatisticas: svg(P("M4 20V10M10 20V4M16 20v-7M22 20H2")),
  ranking: svg(P("M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4")),
  ajuda: svg(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>${P("M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.2v.1")}`),
  config: svg(`<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>${P("M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1")}`),
  fechar: svg(P("M6 6l12 12M18 6 6 18")),
  apagar: svg(P("M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7ZM12 9l6 6M18 9l-6 6")),
  cadeadoAberto: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5" fill="currentColor"/>${P("M8 11V7a4 4 0 0 1 7.6-1.7")}</svg>`,
};

export function mountIcons(root = document) {
  root.querySelectorAll("[data-panel]").forEach((btn) => {
    const icon = ICONS[btn.dataset.panel];
    if (icon && !btn.firstChild) btn.innerHTML = icon;
  });
  const close = document.getElementById("sheet-close");
  if (close && !close.firstChild) close.innerHTML = ICONS.fechar;
}

export function toast(message, ms = 2400) {
  const box = document.getElementById("toasts");
  const item = el("div", { class: "toast", role: "status", text: message });
  box.append(item);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => {
    item.classList.add("toast--out");
    item.addEventListener("animationend", () => item.remove(), { once: true });
    setTimeout(() => item.remove(), 400);
  }, ms);
}

export function announce(text) {
  const node = document.getElementById("announcer");
  node.textContent = "";
  requestAnimationFrame(() => (node.textContent = text));
}

let sheetOnClose = null;

export function openSheet(title, content, { onClose } = {}) {
  const dialog = document.getElementById("sheet");
  document.getElementById("sheet-title").textContent = title;
  const body = document.getElementById("sheet-body");
  body.replaceChildren(...[].concat(content));
  sheetOnClose = onClose || null;
  if (!dialog.open) dialog.showModal();
  body.scrollTop = 0;
  return body;
}

export function closeSheet() {
  const dialog = document.getElementById("sheet");
  if (dialog.open) dialog.close();
}

export function setupSheet() {
  const dialog = document.getElementById("sheet");
  document.getElementById("sheet-close").addEventListener("click", closeSheet);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeSheet();
  });
  dialog.addEventListener("close", () => {
    const fn = sheetOnClose;
    sheetOnClose = null;
    if (fn) fn();
  });
}

export function spinner() {
  return el("div", { class: "spinner", role: "progressbar", "aria-label": "Carregando" });
}

export function segmented(options, value, onChange, label) {
  const wrap = el("div", { class: "seg", role: "group", "aria-label": label });
  for (const opt of options) {
    const b = el("button", {
      type: "button",
      "aria-pressed": String(opt.value === value),
      text: opt.label,
      onclick: () => {
        wrap.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        onChange(opt.value);
      },
    });
    wrap.append(b);
  }
  return wrap;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el("textarea", { style: "position:fixed;opacity:0" });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function avatarImg(url, alt = "") {
  const img = el("img", { src: url || "https://cdn.discordapp.com/embed/avatars/0.png", alt, width: 32, height: 32, loading: "lazy", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => {
    img.src = "https://cdn.discordapp.com/embed/avatars/0.png";
  }, { once: true });
  return img;
}

export function formatDayMonth(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function formatLongDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" }).format(dt);
}
