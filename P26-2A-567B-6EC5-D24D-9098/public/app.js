// public/app.js
// Arquivo principal da interface (index.html). Guarda o estado, liga os eventos e
// coordena os filtros. A comunicação com o servidor fica em js/api.js e a
// renderização do DOM em js/ui.js. Sem dependências externas.

import * as api from './js/api.js';
import * as ui from './js/ui.js';

/* ========================================================================== */
/* Constantes                                                                 */
/* ========================================================================== */

// Mensagens para ?auth_error=CODIGO (códigos enviados pelo backend).
const AUTH_ERRORS = {
  invalid_state: 'Sua sessão de login expirou ou é inválida. Tente entrar novamente.',
  not_configured: 'O login com Discord ainda não está configurado no servidor.',
  oauth_error: 'O Discord retornou um erro durante o login. Tente novamente.',
  missing_code: 'O Discord não enviou o código de autorização. Tente novamente.',
  token_exchange_failed: 'Não foi possível concluir a autorização com o Discord.',
  fetch_user_failed: 'Não foi possível obter seus dados no Discord.',
  exception: 'Ocorreu um erro inesperado durante o login. Tente novamente.',
  access_denied: 'Você cancelou a autorização no Discord.',
};

const COPY_STATUS_MS = 6000; // tempo que a mensagem de "copiado" fica visível

/* ========================================================================== */
/* Referências do DOM (ids definidos em index.html)                           */
/* ========================================================================== */

const $ = (id) => document.getElementById(id);

const refs = {
  // Seções principais
  bootSection: $('bootSection'),
  bootMessage: $('bootMessage'),
  loginSection: $('loginSection'),
  authError: $('authError'),
  appSection: $('appSection'),

  // Cabeçalho
  userBar: $('userBar'),
  userAvatar: $('userAvatar'),
  userName: $('userName'),
  logoutBtn: $('logoutBtn'),

  // Barra lateral
  newCollectionBtn: $('newCollectionBtn'),
  collectionsState: $('collectionsState'),
  collectionList: $('collectionList'),

  // Conteúdo
  contentTitle: $('contentTitle'),
  contentDesc: $('contentDesc'),
  newLinkBtn: $('newLinkBtn'),
  collectionActions: $('collectionActions'),
  publishBtn: $('publishBtn'),
  copyLinkBtn: $('copyLinkBtn'),
  unpublishBtn: $('unpublishBtn'),
  editCollectionBtn: $('editCollectionBtn'),
  deleteCollectionBtn: $('deleteCollectionBtn'),
  publicLinkText: $('publicLinkText'),
  copyStatus: $('copyStatus'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  linksState: $('linksState'),
  linkList: $('linkList'),

  // Diálogo de link
  linkDialog: $('linkDialog'),
  linkForm: $('linkForm'),
  linkDialogTitle: $('linkDialogTitle'),
  linkUrl: $('linkUrl'),
  linkTitle: $('linkTitle'),
  linkSummary: $('linkSummary'),
  linkCollection: $('linkCollection'),
  linkStatus: $('linkStatus'),
  linkFormError: $('linkFormError'),
  linkCancelBtn: $('linkCancelBtn'),
  linkSaveBtn: $('linkSaveBtn'),

  // Diálogo de coleção
  collectionDialog: $('collectionDialog'),
  collectionForm: $('collectionForm'),
  collectionDialogTitle: $('collectionDialogTitle'),
  collectionName: $('collectionName'),
  collectionDescription: $('collectionDescription'),
  collectionFormError: $('collectionFormError'),
  collectionCancelBtn: $('collectionCancelBtn'),
  collectionSaveBtn: $('collectionSaveBtn'),

  // Diálogo de confirmação
  confirmDialog: $('confirmDialog'),
  confirmTitle: $('confirmTitle'),
  confirmText: $('confirmText'),
  confirmError: $('confirmError'),
  confirmCancelBtn: $('confirmCancelBtn'),
  confirmOkBtn: $('confirmOkBtn'),
};

/* ========================================================================== */
/* Estado                                                                     */
/* ========================================================================== */

const state = {
  user: null,                 // { user_id, username, avatar } ou null
  collections: [],            // resposta de GET /api/collections
  selectedCollectionId: '',   // '' = todas as coleções
  statusFilter: '',           // '' = todos os status
  links: [],                  // resposta de GET /api/links (já filtrada pelo servidor)
  editingLinkId: null,        // null = criando um link novo
  editingCollectionId: null,  // null = criando uma coleção nova
  linksRequestId: 0,          // evita que uma resposta antiga sobrescreva uma nova
  pendingAuthError: '',       // mensagem vinda de ?auth_error=
  confirm: null,              // { run, done } da confirmação aberta
  copyTimer: null,            // timeout que esconde a mensagem de "copiado"
};

let retryBtn = null; // botão "Tentar novamente" da tela inicial

/* ========================================================================== */
/* Funções auxiliares                                                         */
/* ========================================================================== */

/** ids numéricos viram número ao enviar para a API; outros valores seguem como texto. */
const toId = (value) => (/^\d+$/.test(String(value)) ? Number(value) : value);

/** Coleção atualmente selecionada na barra lateral (ou undefined). */
const getSelectedCollection = () =>
  state.collections.find((c) => String(c.id) === state.selectedCollectionId);

/** Link público de uma coleção: /colecao.html?s=SLUG */
const buildPublicUrl = (slug) =>
  `${window.location.origin}/colecao.html?s=${encodeURIComponent(slug)}`;

/** Liga/desliga o estado "ocupado" de um botão, trocando o texto. */
function setBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
  button.disabled = busy;
}

// Elementos da área do usuário no cabeçalho, no formato esperado por ui.renderUserBar.
const userBarRefs = { bar: refs.userBar, avatar: refs.userAvatar, name: refs.userName };

/** Mostra só uma das três telas: 'boot', 'login' ou 'app'. */
function showOnly(screen) {
  refs.bootSection.hidden = screen !== 'boot';
  refs.loginSection.hidden = screen !== 'login';
  refs.appSection.hidden = screen !== 'app';
  if (screen !== 'app') ui.renderUserBar(userBarRefs, null); // fora do app não há usuário no cabeçalho
}

/* ========================================================================== */
/* Sessão e login                                                             */
/* ========================================================================== */

/** Lê ?auth_error= / ?login=success e limpa a URL. Devolve a mensagem de erro (ou ''). */
function readLoginResultFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let message = '';

  if (params.has('auth_error')) {
    const code = params.get('auth_error') || '';
    message = AUTH_ERRORS[code] || `Não foi possível entrar (código: ${code.slice(0, 60)}).`;
  }

  if (params.has('auth_error') || params.has('login')) {
    window.history.replaceState({}, '', window.location.pathname); // tira a query da barra de endereço
  }
  return message;
}

/** Verifica a sessão com GET /api/auth/me e decide qual tela mostrar. */
async function checkSession() {
  showOnly('boot');
  ui.setMessage(refs.bootMessage, 'Carregando…', 'loading');

  try {
    const user = await api.getMe();
    await enterApp(user);
  } catch (error) {
    if (error.status === 401) {
      showLogin();
    } else {
      showBootError(error.message);
    }
  }
}

/** Tela de login. Mostra a mensagem recebida ou a de ?auth_error=, se houver. */
function showLogin(message = '') {
  showOnly('login');
  ui.setMessage(refs.authError, message || state.pendingAuthError, 'error');
  state.pendingAuthError = '';
}

/** Erro ao verificar a sessão (rede/servidor): mostra a mensagem com botão para repetir. */
function showBootError(message) {
  showOnly('boot');
  ui.setMessage(refs.bootMessage, message, 'error');

  if (!retryBtn) {
    retryBtn = ui.el('button', {
      className: 'btn btn--primary',
      text: 'Tentar novamente',
      attrs: { type: 'button' },
    });
    retryBtn.addEventListener('click', () => {
      retryBtn.remove();
      retryBtn = null;
      checkSession();
    });
    refs.bootSection.append(retryBtn);
  }
}

/** Chamado pela camada de API quando uma rota protegida devolve 401. */
function handleSessionExpired() {
  if (!state.user) return; // já estamos na tela de login
  resetState();
  showLogin('Sua sessão expirou. Entre novamente.');
}

/** Limpa tudo o que pertence ao usuário anterior. */
function resetState() {
  closeAllDialogs();
  state.user = null;
  state.collections = [];
  state.selectedCollectionId = '';
  state.statusFilter = '';
  state.links = [];
  state.editingLinkId = null;
  state.editingCollectionId = null;
  state.linksRequestId += 1;
  refs.collectionList.replaceChildren();
  refs.linkList.replaceChildren();
  ui.setMessage(refs.collectionsState, '');
  ui.setMessage(refs.linksState, '');
  ui.setMessage(refs.copyStatus, '');
  ui.setActiveFilter(refs.filterButtons, '');
}

function closeAllDialogs() {
  for (const dialog of [refs.linkDialog, refs.collectionDialog, refs.confirmDialog]) {
    if (dialog.open) dialog.close();
  }
}

/** Entra no aplicativo depois de confirmar a sessão. */
async function enterApp(user) {
  state.user = user;
  state.selectedCollectionId = '';
  state.statusFilter = '';
  ui.setActiveFilter(refs.filterButtons, '');
  showOnly('app');
  ui.renderUserBar(userBarRefs, user);

  await loadCollections();
  await loadLinks();
}

async function handleLogout() {
  setBusy(refs.logoutBtn, true, 'Saindo…');
  try {
    await api.logout();
    resetState();
    showLogin();
  } catch (error) {
    ui.setMessage(refs.linksState, `Não foi possível sair: ${error.message}`, 'error');
  } finally {
    setBusy(refs.logoutBtn, false);
  }
}

/* ========================================================================== */
/* Coleções                                                                   */
/* ========================================================================== */

/** Carrega GET /api/collections e redesenha a barra lateral e o cabeçalho do conteúdo. */
async function loadCollections() {
  if (state.collections.length === 0) {
    ui.setMessage(refs.collectionsState, 'Carregando coleções…', 'loading');
  }

  try {
    const data = await api.listCollections();
    state.collections = data.collections;

    // Se a coleção selecionada deixou de existir, volta para "Todas".
    if (state.selectedCollectionId && !getSelectedCollection()) {
      state.selectedCollectionId = '';
    }

    renderCollections();
    renderContentHeader();

    if (state.collections.length === 0) {
      ui.setMessage(refs.collectionsState, 'Você ainda não tem coleções. Crie a primeira em “Nova coleção”.');
    } else {
      ui.setMessage(refs.collectionsState, '');
    }
  } catch (error) {
    ui.setMessage(refs.collectionsState, error.message, 'error');
  }
}

function renderCollections() {
  ui.renderCollectionList(
    refs.collectionList,
    state.collections,
    state.selectedCollectionId,
    selectCollection,
  );
}

/** Troca a coleção selecionada ('' = todas) e recarrega os links com o filtro combinado. */
async function selectCollection(id) {
  state.selectedCollectionId = id;
  ui.setMessage(refs.copyStatus, '');
  renderCollections();
  renderContentHeader();
  await loadLinks();
}

/** Título, descrição e ações da coleção selecionada. */
function renderContentHeader() {
  const collection = getSelectedCollection();

  if (!collection) {
    refs.contentTitle.textContent = 'Todos os links';
    refs.contentDesc.textContent = '';
    refs.contentDesc.hidden = true;
    refs.collectionActions.hidden = true;
    return;
  }

  refs.contentTitle.textContent = collection.name;
  refs.contentDesc.textContent = collection.description || '';
  refs.contentDesc.hidden = !collection.description;

  const isPublic = Boolean(collection.is_public) && Boolean(collection.public_slug);
  refs.publishBtn.hidden = isPublic;
  refs.copyLinkBtn.hidden = !isPublic;
  refs.unpublishBtn.hidden = !isPublic;
  refs.publicLinkText.hidden = !isPublic;
  refs.publicLinkText.textContent = isPublic ? buildPublicUrl(collection.public_slug) : '';
  refs.collectionActions.hidden = false;
}

/* ---- Diálogo de coleção (criar / renomear) ---- */

function openCollectionDialog(collection = null) {
  state.editingCollectionId = collection ? collection.id : null;
  refs.collectionDialogTitle.textContent = collection ? 'Renomear coleção' : 'Nova coleção';
  refs.collectionName.value = collection ? collection.name : '';
  refs.collectionDescription.value = collection ? collection.description || '' : '';
  ui.setMessage(refs.collectionFormError, '');
  refs.collectionDialog.showModal();
  refs.collectionName.focus();
}

async function submitCollectionForm(event) {
  event.preventDefault();

  if (!refs.collectionForm.checkValidity()) {
    refs.collectionForm.reportValidity();
    return;
  }

  const name = refs.collectionName.value.trim();
  const description = refs.collectionDescription.value.trim();
  if (!name) {
    ui.setMessage(refs.collectionFormError, 'Informe o nome da coleção.', 'error');
    return;
  }

  setBusy(refs.collectionSaveBtn, true, 'Salvando…');
  ui.setMessage(refs.collectionFormError, '');

  try {
    if (state.editingCollectionId !== null) {
      // Edição: envia a descrição mesmo vazia, para permitir apagá-la.
      await api.updateCollection(state.editingCollectionId, { name, description });
    } else {
      const payload = description ? { name, description } : { name };
      const data = await api.createCollection(payload);
      state.selectedCollectionId = String(data.collection.id); // já abre a coleção nova
    }
    refs.collectionDialog.close();
    await loadCollections();
    await loadLinks();
  } catch (error) {
    // Ex.: 409 (nome repetido) ou 400 (validação) — mensagem vem do servidor.
    ui.setMessage(refs.collectionFormError, error.message, 'error');
  } finally {
    setBusy(refs.collectionSaveBtn, false);
  }
}

/* ---- Excluir coleção ---- */

function confirmDeleteCollection() {
  const collection = getSelectedCollection();
  if (!collection) return;

  const count = Number(collection.link_count) || 0;
  const extra = count > 0 ? ` Os ${count} ${count === 1 ? 'link dela também será apagado' : 'links dela também serão apagados'}.` : '';

  askConfirm({
    title: 'Excluir coleção',
    text: `Excluir a coleção “${collection.name}”?${extra} Esta ação não pode ser desfeita.`,
    okLabel: 'Excluir',
    run: () => api.deleteCollection(collection.id),
    done: async () => {
      state.selectedCollectionId = '';
      await loadCollections();
      await loadLinks();
    },
  });
}

/* ---- Visibilidade pública e link ---- */

/** Mostra uma mensagem curta ao lado dos botões de compartilhar. */
function showCopyStatus(message, kind) {
  window.clearTimeout(state.copyTimer);
  ui.setMessage(refs.copyStatus, message, kind);
  state.copyTimer = window.setTimeout(() => ui.setMessage(refs.copyStatus, ''), COPY_STATUS_MS);
}

/** Publica (true) ou despublica (false) a coleção selecionada. */
async function changeVisibility(isPublic) {
  const collection = getSelectedCollection();
  if (!collection) return;

  const button = isPublic ? refs.publishBtn : refs.unpublishBtn;
  setBusy(button, true, 'Aguarde…');

  try {
    const data = await api.setVisibility(collection.id, isPublic);
    const index = state.collections.findIndex((c) => String(c.id) === String(collection.id));
    if (index !== -1) {
      state.collections[index] = { ...state.collections[index], ...data.collection };
    }
    renderCollections();
    renderContentHeader();
    showCopyStatus(
      isPublic ? 'Coleção publicada. Use “Copiar link” para compartilhar.' : 'A coleção agora é privada.',
      'ok',
    );
  } catch (error) {
    showCopyStatus(error.message, 'error');
  } finally {
    setBusy(button, false);
  }
}

function confirmUnpublish() {
  const collection = getSelectedCollection();
  if (!collection) return;

  askConfirm({
    title: 'Tornar coleção privada',
    text: `Tornar “${collection.name}” privada? O link público atual deixará de funcionar. Se você publicar de novo, será gerado um link novo.`,
    okLabel: 'Tornar privada',
    run: () => api.setVisibility(collection.id, false),
    done: async () => {
      await loadCollections();
      showCopyStatus('A coleção agora é privada.', 'ok');
    },
  });
}

/** Copia colecao.html?s=SLUG para a área de transferência. */
async function copyPublicLink() {
  const collection = getSelectedCollection();
  if (!collection || !collection.public_slug) return;

  try {
    if (!navigator.clipboard) throw new Error('Área de transferência indisponível.');
    await navigator.clipboard.writeText(buildPublicUrl(collection.public_slug));
    showCopyStatus('Link copiado!', 'ok');
  } catch {
    showCopyStatus('Não foi possível copiar automaticamente. Selecione o link exibido acima e copie manualmente.', 'error');
  }
}

/* ========================================================================== */
/* Links                                                                      */
/* ========================================================================== */

/** Texto exibido quando a lista está vazia, conforme os filtros ativos. */
function emptyLinksMessage() {
  if (state.collections.length === 0) {
    return 'Crie uma coleção para começar a salvar links.';
  }
  if (state.statusFilter) {
    return `Nenhum link com o status “${state.statusFilter}” aqui.`;
  }
  if (state.selectedCollectionId) {
    return 'Esta coleção ainda não tem links. Clique em “Novo link” para adicionar.';
  }
  return 'Você ainda não salvou nenhum link. Clique em “Novo link” para começar.';
}

/**
 * Carrega GET /api/links com o filtro combinado (coleção + status).
 * @param {{keepList?: boolean}} options  keepList: não limpa a lista enquanto carrega.
 */
async function loadLinks({ keepList = false } = {}) {
  const requestId = ++state.linksRequestId;

  if (!keepList) {
    refs.linkList.replaceChildren();
    ui.setMessage(refs.linksState, 'Carregando links…', 'loading');
  }

  try {
    const data = await api.listLinks({
      collectionId: state.selectedCollectionId,
      status: state.statusFilter,
    });
    if (requestId !== state.linksRequestId) return; // chegou uma resposta mais nova

    state.links = data.links;
    renderLinks();
    ui.setMessage(refs.linksState, state.links.length === 0 ? emptyLinksMessage() : '');
  } catch (error) {
    if (requestId !== state.linksRequestId) return;

    // 404: a coleção selecionada não existe mais. Volta para "Todas".
    if (error.status === 404 && state.selectedCollectionId) {
      state.selectedCollectionId = '';
      await loadCollections();
      await loadLinks();
      return;
    }
    refs.linkList.replaceChildren();
    ui.setMessage(refs.linksState, error.message, 'error');
  }
}

function renderLinks() {
  const collectionsById = new Map(state.collections.map((c) => [String(c.id), c]));
  ui.renderLinkList(refs.linkList, state.links, {
    collectionsById,
    showCollection: state.selectedCollectionId === '',
    onEdit: openLinkDialog,
    onDelete: confirmDeleteLink,
  });
}

/** Depois de criar/editar/excluir um link: atualiza contadores e lista sem recarregar a página. */
async function refreshAfterLinkChange() {
  await loadCollections();
  await loadLinks({ keepList: true });
}

/** Clique em um botão de filtro de status. */
async function selectStatus(status) {
  state.statusFilter = status;
  ui.setActiveFilter(refs.filterButtons, status);
  await loadLinks();
}

/* ---- Diálogo de link (criar / editar) ---- */

function openLinkDialog(link = null) {
  // Todo link precisa de uma coleção: sem nenhuma, leva o usuário a criar a primeira.
  if (!link && state.collections.length === 0) {
    ui.setMessage(refs.linksState, 'Crie uma coleção antes de adicionar links.', 'error');
    openCollectionDialog();
    return;
  }

  state.editingLinkId = link ? link.id : null;
  refs.linkDialogTitle.textContent = link ? 'Editar link' : 'Novo link';

  const defaultCollection = link ? link.collection_id : state.selectedCollectionId || state.collections[0].id;
  ui.fillCollectionSelect(refs.linkCollection, state.collections, defaultCollection);

  refs.linkUrl.value = link ? link.url : '';
  refs.linkTitle.value = link ? link.title : '';
  refs.linkSummary.value = link ? link.summary || '' : '';
  refs.linkStatus.value = link ? link.status : 'Para Ler';
  ui.setMessage(refs.linkFormError, '');

  refs.linkDialog.showModal();
  refs.linkUrl.focus();
}

async function submitLinkForm(event) {
  event.preventDefault();

  // Validação do navegador é só conveniência; a validação real é do servidor.
  if (!refs.linkForm.checkValidity()) {
    refs.linkForm.reportValidity();
    return;
  }

  const title = refs.linkTitle.value.trim();
  if (!title) {
    ui.setMessage(refs.linkFormError, 'Informe o título do link.', 'error');
    return;
  }

  const summary = refs.linkSummary.value.trim();
  const payload = {
    collection_id: toId(refs.linkCollection.value),
    url: refs.linkUrl.value.trim(),
    title,
    status: refs.linkStatus.value,
  };

  setBusy(refs.linkSaveBtn, true, 'Salvando…');
  ui.setMessage(refs.linkFormError, '');

  try {
    if (state.editingLinkId !== null) {
      // Edição: envia o resumo mesmo vazio, para permitir apagá-lo.
      await api.updateLink(state.editingLinkId, { ...payload, summary });
    } else {
      await api.createLink(summary ? { ...payload, summary } : payload);
    }
    refs.linkDialog.close();
    await refreshAfterLinkChange();
  } catch (error) {
    ui.setMessage(refs.linkFormError, error.message, 'error'); // mensagem do servidor
  } finally {
    setBusy(refs.linkSaveBtn, false);
  }
}

function confirmDeleteLink(link) {
  askConfirm({
    title: 'Excluir link',
    text: `Excluir o link “${link.title}”? Esta ação não pode ser desfeita.`,
    okLabel: 'Excluir',
    run: () => api.deleteLink(link.id),
    done: refreshAfterLinkChange,
  });
}

/* ========================================================================== */
/* Diálogo de confirmação                                                     */
/* ========================================================================== */

/**
 * Abre o diálogo de confirmação.
 * @param {{title: string, text: string, okLabel: string,
 *          run: () => Promise<unknown>, done?: () => Promise<void>}} options
 *   run: ação feita ao confirmar (erros aparecem no próprio diálogo).
 *   done: executada depois que o diálogo fecha com sucesso.
 */
function askConfirm({ title, text, okLabel, run, done }) {
  state.confirm = { run, done };
  refs.confirmTitle.textContent = title;
  refs.confirmText.textContent = text;
  refs.confirmOkBtn.textContent = okLabel;
  ui.setMessage(refs.confirmError, '');
  refs.confirmDialog.showModal();
  refs.confirmCancelBtn.focus(); // foco no botão seguro
}

async function handleConfirmOk() {
  const pending = state.confirm;
  if (!pending) return;

  const label = refs.confirmOkBtn.textContent;
  refs.confirmOkBtn.disabled = true;
  refs.confirmCancelBtn.disabled = true;
  refs.confirmOkBtn.textContent = 'Aguarde…';

  try {
    await pending.run();
    state.confirm = null;
    refs.confirmDialog.close();
    if (pending.done) await pending.done();
  } catch (error) {
    ui.setMessage(refs.confirmError, error.message, 'error');
  } finally {
    refs.confirmOkBtn.disabled = false;
    refs.confirmCancelBtn.disabled = false;
    refs.confirmOkBtn.textContent = label;
  }
}

/* ========================================================================== */
/* Eventos                                                                    */
/* ========================================================================== */

function bindEvents() {
  // Cabeçalho
  refs.logoutBtn.addEventListener('click', handleLogout);

  // Barra lateral e ações da coleção
  refs.newCollectionBtn.addEventListener('click', () => openCollectionDialog());
  refs.editCollectionBtn.addEventListener('click', () => openCollectionDialog(getSelectedCollection()));
  refs.deleteCollectionBtn.addEventListener('click', confirmDeleteCollection);
  refs.publishBtn.addEventListener('click', () => changeVisibility(true));
  refs.unpublishBtn.addEventListener('click', confirmUnpublish);
  refs.copyLinkBtn.addEventListener('click', copyPublicLink);

  // Links e filtro de status
  refs.newLinkBtn.addEventListener('click', () => openLinkDialog());
  for (const button of refs.filterButtons) {
    button.addEventListener('click', () => selectStatus(button.dataset.status));
  }

  // Formulários e diálogos
  refs.linkForm.addEventListener('submit', submitLinkForm);
  refs.linkCancelBtn.addEventListener('click', () => refs.linkDialog.close());

  refs.collectionForm.addEventListener('submit', submitCollectionForm);
  refs.collectionCancelBtn.addEventListener('click', () => refs.collectionDialog.close());

  refs.confirmOkBtn.addEventListener('click', handleConfirmOk);
  refs.confirmCancelBtn.addEventListener('click', () => refs.confirmDialog.close());
  refs.confirmDialog.addEventListener('close', () => {
    state.confirm = null;
  });

  // Sessão expirada em qualquer chamada protegida
  api.onUnauthorized(handleSessionExpired);
}

/* ========================================================================== */
/* Início                                                                     */
/* ========================================================================== */

state.pendingAuthError = readLoginResultFromUrl();
bindEvents();
checkSession();