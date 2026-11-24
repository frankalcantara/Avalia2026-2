// public/js/ui.js
// Renderização do DOM. Regra de ouro: dados vindos do usuário ou do servidor
// (título, resumo, nome da coleção, username, URL) entram SEMPRE por
// document.createElement + textContent (ou atributos validados), nunca por HTML em texto.

/* ------------------------------ Utilitários ------------------------------- */

/**
 * Cria um elemento.
 * @param {string} tag
 * @param {{className?: string, text?: string, attrs?: Record<string,string>}} options
 * @param {Array<Node|string>} children
 */
export function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  }
  for (const child of children) {
    node.append(child); // strings viram nós de texto (nunca HTML)
  }
  return node;
}

/**
 * Mostra ou esconde uma mensagem de estado (elemento com a classe "state").
 * @param {HTMLElement} node
 * @param {string} message  Vazio = esconde.
 * @param {'loading'|'error'|'ok'|''} kind
 */
export function setMessage(node, message, kind = '') {
  if (!message) {
    node.textContent = '';
    node.hidden = true;
    return;
  }
  node.textContent = message;
  node.className = kind ? `state state--${kind}` : 'state';
  node.hidden = false;
}

/** Devolve a URL normalizada se for http/https; caso contrário, null. */
export function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Datas do servidor vêm como 'YYYY-MM-DD HH:MM:SS' em UTC. */
export function formatDate(sqlTimestamp) {
  if (!sqlTimestamp) return '';
  const date = new Date(`${String(sqlTimestamp).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
}

/** Coloca a imagem do avatar (se a URL for válida) ou a esconde. */
export function setAvatar(img, url) {
  const safe = url ? safeHttpUrl(url) : null;
  if (safe) {
    img.src = safe;
    img.hidden = false;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
  }
}

/* -------------------------------- Cabeçalho ------------------------------- */

/** Preenche (ou esconde, se user for null) a área do usuário no cabeçalho. */
export function renderUserBar({ bar, avatar, name }, user) {
  if (!user) {
    bar.hidden = true;
    name.textContent = '';
    setAvatar(avatar, null);
    return;
  }
  name.textContent = user.username;
  setAvatar(avatar, user.avatar);
  bar.hidden = false;
}

/* -------------------------------- Coleções -------------------------------- */

/**
 * Desenha a lista da barra lateral: primeiro "Todas as coleções", depois uma por coleção.
 * @param {HTMLElement} listEl
 * @param {Array} collections
 * @param {string} selectedId  '' = todas.
 * @param {(id: string) => void} onSelect
 */
export function renderCollectionList(listEl, collections, selectedId, onSelect) {
  const total = collections.reduce((sum, c) => sum + (Number(c.link_count) || 0), 0);

  const items = [
    buildCollectionItem({
      id: '',
      name: 'Todas as coleções',
      count: total,
      isPublic: false,
      selected: selectedId === '',
      onSelect,
    }),
    ...collections.map((c) =>
      buildCollectionItem({
        id: String(c.id),
        name: c.name,
        count: Number(c.link_count) || 0,
        isPublic: Boolean(c.is_public),
        selected: String(c.id) === selectedId,
        onSelect,
      }),
    ),
  ];

  listEl.replaceChildren(...items);
}

function buildCollectionItem({ id, name, count, isPublic, selected, onSelect }) {
  const meta = el('span', { className: 'collection-meta' });
  if (isPublic) meta.append(el('span', { className: 'public-mark', text: 'Pública' }));
  meta.append(el('span', { className: 'collection-count', text: String(count) }));

  const label = `${name}, ${count} ${count === 1 ? 'link' : 'links'}${isPublic ? ', pública' : ''}`;
  const button = el(
    'button',
    { className: 'collection-btn', attrs: { type: 'button', 'aria-label': label } },
    [el('span', { className: 'collection-name', text: name }), meta],
  );
  if (selected) button.setAttribute('aria-current', 'true');
  button.addEventListener('click', () => onSelect(id));

  return el('li', {}, [button]);
}

/** Preenche o <select> de coleções do formulário de link. */
export function fillCollectionSelect(select, collections, selectedId) {
  const options = collections.map((c) => {
    const option = el('option', { text: c.name, attrs: { value: String(c.id) } });
    option.selected = String(c.id) === String(selectedId);
    return option;
  });
  select.replaceChildren(...options);
}

/** Marca como pressionado o botão de filtro que corresponde ao status ('' = Todos). */
export function setActiveFilter(buttons, status) {
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.status === status));
  }
}

/* ---------------------------------- Links --------------------------------- */

const BADGE_CLASSES = {
  'Para Ler': 'badge--para-ler',
  Lendo: 'badge--lendo',
  Concluído: 'badge--concluido',
};

/** Pílula com o status do link. */
export function buildStatusBadge(status) {
  const extra = BADGE_CLASSES[status] ? ` ${BADGE_CLASSES[status]}` : '';
  return el('span', { className: `badge${extra}`, text: status });
}

/** <a> para a URL do link; só recebe href se a URL for http/https. */
function buildUrlAnchor(url) {
  const anchor = el('a', { className: 'link-url', text: url });
  const safe = safeHttpUrl(url);
  if (safe) {
    anchor.href = safe;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

/**
 * Desenha os cards dos links do usuário.
 * @param {HTMLElement} listEl
 * @param {Array} links
 * @param {{collectionsById: Map<string, object>, showCollection: boolean,
 *          onEdit: (link: object) => void, onDelete: (link: object) => void}} options
 */
export function renderLinkList(listEl, links, { collectionsById, showCollection, onEdit, onDelete }) {
  const items = links.map((link) => {
    const card = el('article', { className: 'link-card' });

    card.append(
      el('div', { className: 'link-card__head' }, [
        el('h3', { className: 'link-title', text: link.title }),
        buildStatusBadge(link.status),
      ]),
      buildUrlAnchor(link.url),
    );

    if (link.summary) {
      card.append(el('p', { className: 'link-summary', text: link.summary }));
    }

    // Linha de detalhes: coleção (quando a lista mistura coleções) e data.
    const details = [];
    if (showCollection) {
      const collection = collectionsById.get(String(link.collection_id));
      if (collection) details.push(`Coleção: ${collection.name}`);
    }
    const date = formatDate(link.created_at);
    if (date) details.push(`Adicionado em ${date}`);
    if (details.length) {
      card.append(el('p', { className: 'link-card__meta', text: details.join(' · ') }));
    }

    const editBtn = el('button', {
      className: 'btn btn--secondary btn--small',
      text: 'Editar',
      attrs: { type: 'button', 'aria-label': `Editar link: ${link.title}` },
    });
    editBtn.addEventListener('click', () => onEdit(link));

    const deleteBtn = el('button', {
      className: 'btn btn--danger btn--small',
      text: 'Excluir',
      attrs: { type: 'button', 'aria-label': `Excluir link: ${link.title}` },
    });
    deleteBtn.addEventListener('click', () => onDelete(link));

    card.append(el('div', { className: 'link-actions' }, [editBtn, deleteBtn]));

    return el('li', {}, [card]);
  });

  listEl.replaceChildren(...items);
}

/** Item da página pública (sem ações e sem badge: os links já estão agrupados por status). */
export function buildPublicItem(link) {
  const card = el('article', { className: 'link-card' }, [
    el('h3', { className: 'link-title', text: link.title }),
    buildUrlAnchor(link.url),
  ]);
  if (link.summary) {
    card.append(el('p', { className: 'link-summary', text: link.summary }));
  }
  return el('li', {}, [card]);
}