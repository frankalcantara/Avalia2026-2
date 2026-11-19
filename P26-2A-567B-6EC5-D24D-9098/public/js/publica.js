// public/js/publica.js
// Página pública (colecao.html): lê o slug de ?s=SLUG, chama GET /api/public/:slug
// (sem login) e desenha título, descrição, autor e links agrupados por status.

import { getPublic } from './api.js';
import { buildPublicItem, setAvatar, setMessage } from './ui.js';

// Limite de segurança só para evitar slugs absurdos; a validação real é do servidor.
const MAX_SLUG_LENGTH = 100;

/** Ponto de entrada: chamado por public/colecao.js. */
export async function iniciarPublica() {
  const refs = {
    state: document.getElementById('publicState'),
    view: document.getElementById('publicView'),
    title: document.getElementById('publicTitle'),
    desc: document.getElementById('publicDesc'),
    ownerAvatar: document.getElementById('ownerAvatar'),
    ownerName: document.getElementById('ownerName'),
    empty: document.getElementById('publicEmpty'),
    groups: document.querySelectorAll('.group[data-status]'),
  };

  const slug = (new URLSearchParams(window.location.search).get('s') || '').trim();
  if (!slug || slug.length > MAX_SLUG_LENGTH) {
    setMessage(refs.state, 'Link inválido: o endereço não informa qual coleção abrir.', 'error');
    return;
  }

  setMessage(refs.state, 'Carregando coleção…', 'loading');

  try {
    const data = await getPublic(slug);
    renderCollection(refs, data);
    setMessage(refs.state, ''); // esconde o "carregando"
  } catch (error) {
    // Mostra a mensagem do servidor (ex.: coleção inexistente ou não pública).
    refs.view.hidden = true;
    setMessage(refs.state, error.message, 'error');
  }
}

/** Preenche a página com os dados recebidos. Tudo entra via textContent. */
function renderCollection(refs, { collection, links }) {
  document.title = `${collection.name} · Bookmark Manager`;
  refs.title.textContent = collection.name;

  if (collection.description) {
    refs.desc.textContent = collection.description;
    refs.desc.hidden = false;
  } else {
    refs.desc.textContent = '';
    refs.desc.hidden = true;
  }

  const owner = collection.owner || {};
  refs.ownerName.textContent = owner.username || 'autor desconhecido';
  setAvatar(refs.ownerAvatar, owner.avatar);

  // Um bloco por status; blocos sem links ficam escondidos. A ordem de inclusão é mantida.
  let total = 0;
  for (const group of refs.groups) {
    const status = group.dataset.status;
    const items = links.filter((link) => link.status === status).map(buildPublicItem);
    group.querySelector('.public-list').replaceChildren(...items);
    group.hidden = items.length === 0;
    total += items.length;
  }

  refs.empty.hidden = total > 0;
  refs.view.hidden = false;
}