// Helpers de DOM. Todo conteúdo dinâmico entra via textContent ou atributos,
// nunca via innerHTML (evita XSS com dados vindos do servidor).

/**
 * Cria um elemento: h('a', { href: '#/', class: 'btn' }, 'texto', outroNo)
 * - atributos "on*" com função viram addEventListener
 * - valores false/null/undefined são ignorados
 * - strings e números viram nós de texto
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k in el && typeof v !== 'string' && k !== 'list') {
      el[k] = v; // propriedades como checked, disabled, value
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Substitui todo o conteúdo de um elemento pelos filhos informados. */
export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

// Formatação de datas sempre em pt-BR.
const fmtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const formatarData = (ms) => fmtData.format(new Date(ms));

/** Converte milissegundos restantes em texto curto: "2d 3h", "4h 10min", "45s". */
export function tempoRestante(ms) {
  if (ms <= 0) return 'agora';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d > 0) return `${d}d ${hh}h`;
  if (hh > 0) return `${hh}h ${m}min`;
  if (m > 0) return `${m}min ${ss}s`;
  return `${ss}s`;
}

/** Valor para <input type="datetime-local"> no fuso local. */
export function paraDatetimeLocal(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}
