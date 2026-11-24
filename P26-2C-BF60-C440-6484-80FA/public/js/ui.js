// Utilidades de DOM. Todo dado da API entra por textContent ou atributos.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  appendAll(node, children);
  return node;
}

function appendAll(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// ---------- Rótulos ----------
export const CATEGORY_LABEL = { tecnico: 'Técnico', literario: 'Literário' };
export const MODE_LABEL = { emprestimo: 'Empréstimo', troca: 'Troca', ambos: 'Empréstimo ou troca' };
export const CONDITION_LABEL = { novo: 'Novo', bom: 'Bom estado', usado: 'Usado', desgastado: 'Desgastado' };
export const TYPE_LABEL = { emprestimo: 'Empréstimo', troca: 'Troca' };
export const REQUEST_STATUS_LABEL = {
  pendente: 'Pendente',
  aprovado: 'Emprestado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  devolvido: 'Devolvido',
  concluido: 'Troca concluída',
};

export const label = (map, key) => map[key] || key || '—';

// ---------- Datas (YYYY-MM-DD em UTC, como no contrato) ----------
export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysUTC(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function fmtDate(value) {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function isOverdue(ymd) {
  return typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd < todayUTC();
}

// ---------- Componentes ----------
const STATUS_CLASS = { 'Disponível': 'disponivel', 'Reservado': 'reservado', 'Emprestado': 'emprestado' };

export function statusPill(status) {
  return el('span', { class: `pill pill--${STATUS_CLASS[status] || 'neutro'}`, text: status || '—' });
}

export function requestPill(status) {
  return el('span', { class: `pill pill--req-${status || 'neutro'}`, text: label(REQUEST_STATUS_LABEL, status) });
}

export function tag(text, extra = '') {
  return el('span', { class: `tag ${extra}`.trim(), text });
}

function initials(user) {
  const base = (user && (user.display_name || user.username)) || '?';
  const parts = base.trim().split(/\s+/).filter(Boolean);
  const chars = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : base.slice(0, 2);
  return chars.toUpperCase();
}

export function avatar(user, size = 'md') {
  const fallback = () => el('span', { class: `avatar avatar--${size} avatar--initials`, 'aria-hidden': 'true', text: initials(user) });
  const url = user && user.avatar_url;
  if (!url || !/^https:\/\//i.test(url)) return fallback();
  const img = el('img', {
    class: `avatar avatar--${size}`, src: url, alt: '', loading: 'lazy', decoding: 'async',
    referrerpolicy: 'no-referrer', width: size === 'sm' ? 24 : 36, height: size === 'sm' ? 24 : 36,
  });
  img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
  return img;
}

export function handle(user) {
  return user && user.username ? `@${user.username}` : '@desconhecido';
}

/** Linha "avatar · nome · @handle [Copiar]" para contato pelo Discord. */
export function personLine(user, { prefix = '', size = 'sm', copy = true } = {}) {
  const line = el('div', { class: 'person' },
    avatar(user, size),
    el('span', { class: 'person-text' },
      prefix ? el('span', { class: 'person-prefix', text: prefix }) : null,
      user && user.display_name ? el('span', { class: 'person-name', text: user.display_name }) : null,
      el('span', { class: 'person-handle', text: handle(user) }),
    ),
  );
  if (copy && user && user.username && navigator.clipboard) {
    line.append(el('button', {
      type: 'button', class: 'btn btn-link btn-xs',
      'aria-label': `Copiar ${handle(user)}`,
      text: 'Copiar',
      onclick: async (ev) => {
        ev.stopPropagation();
        try {
          await navigator.clipboard.writeText(handle(user));
          toast(`${handle(user)} copiado. Procure no Discord para combinar a entrega.`, 'success');
        } catch {
          toast('Não foi possível copiar. Selecione o texto manualmente.', 'error');
        }
      },
    }));
  }
  return line;
}

// ---------- Toasts (aria-live) ----------
export function toast(message, kind = 'info', timeout = 6000) {
  const region = document.getElementById('toasts');
  if (!region) return;
  // A região #toasts já é aria-live; o prefixo visualmente oculto diz o tipo do aviso.
  const prefix = { error: 'Erro: ', success: 'Pronto: ', info: '' }[kind] || '';
  const item = el('div', { class: `toast toast--${kind}` },
    el('p', { class: 'toast-msg' }, prefix ? el('span', { class: 'sr-only', text: prefix }) : null, message),
    el('button', { type: 'button', class: 'toast-close', 'aria-label': 'Fechar aviso', text: '×', onclick: () => item.remove() }),
  );
  region.append(item);
  if (timeout) setTimeout(() => item.remove(), kind === 'error' ? timeout + 4000 : timeout);
}

// ---------- Estados de lista ----------
/** state: loading | empty | error | ok */
export function setListStatus(node, state, text, retry) {
  node.dataset.state = state;
  node.replaceChildren(el('span', { text }));
  if (state === 'error' && retry) {
    node.append(' ', el('button', { type: 'button', class: 'btn btn-ghost btn-xs', text: 'Tentar de novo', onclick: retry }));
  }
}

// ---------- Botão em voo ----------
/** Desabilita os botões dados (ou um contêiner inteiro) enquanto `fn` roda. */
export async function busy(button, busyText, fn, scope) {
  const controls = scope ? [...scope.querySelectorAll('button, input, select, textarea')] : [button];
  const original = button.textContent;
  const previous = controls.map((c) => c.disabled);
  controls.forEach((c) => { c.disabled = true; });
  button.setAttribute('aria-busy', 'true');
  if (busyText) button.textContent = busyText;
  try {
    return await fn();
  } finally {
    if (button.isConnected) {
      button.textContent = original;
      button.removeAttribute('aria-busy');
    }
    controls.forEach((c, i) => { if (c.isConnected) c.disabled = previous[i]; });
  }
}

/** Contador de caracteres ligado a um campo com maxlength. */
export function charCounter(field, counter) {
  const max = Number(field.getAttribute('maxlength')) || 0;
  const update = () => { counter.textContent = `${field.value.length}/${max}`; };
  field.addEventListener('input', update);
  update();
  return update;
}
