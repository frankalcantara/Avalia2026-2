// Ponto de entrada: sessão (/api/me), cabeçalho, rotas por hash e avisos de login.
import { api } from './js/api.js';
import { avatar, handle, toast, busy } from './js/ui.js';
import { state, setUser, on } from './js/state.js';
import { initCatalog, loadCatalog } from './js/catalog.js';
import { initDashboard, renderPainel } from './js/dashboard.js';

const loginLink = document.getElementById('login-link');
const userChip = document.getElementById('user-chip');
const avatarSlot = document.getElementById('user-avatar-slot');
const userDisplay = document.getElementById('user-display');
const userHandle = document.getElementById('user-handle');
const logoutBtn = document.getElementById('logout-btn');

const views = {
  catalogo: document.getElementById('view-catalogo'),
  painel: document.getElementById('view-painel'),
};
let currentRoute = null;

// ---------- Cabeçalho ----------
function renderAuth() {
  const user = state.user;
  loginLink.hidden = !!user;
  userChip.hidden = !user;
  if (user) {
    avatarSlot.replaceChildren(avatar(user, 'md'));
    userDisplay.textContent = user.display_name || user.username || '';
    userHandle.textContent = handle(user);
  } else {
    avatarSlot.replaceChildren();
    userDisplay.textContent = '';
    userHandle.textContent = '';
  }
}

async function loadMe() {
  try {
    const data = await api('/api/me');
    setUser(data.user || null);
  } catch (err) {
    setUser(null);
    toast(`Não foi possível verificar sua sessão: ${err.message}`, 'error');
  }
}

logoutBtn.addEventListener('click', async () => {
  try {
    await busy(logoutBtn, 'Saindo…', () => api('/api/auth/logout', { method: 'POST', body: {} }));
    setUser(null);
    toast('Você saiu da sua conta. Até a próxima leitura!', 'info');
    loadCatalog();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Rotas ----------
function route({ focus = true } = {}) {
  const name = location.hash.replace(/^#/, '');
  const target = views[name] ? name : 'catalogo';
  if (!views[name] && name) history.replaceState(null, '', `${location.pathname}${location.search}#catalogo`);

  for (const dlg of document.querySelectorAll('dialog[open]')) dlg.close();
  for (const [key, view] of Object.entries(views)) view.hidden = key !== target;
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === target) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = `${target === 'painel' ? 'Meu painel' : 'Catálogo'} · Estante Compartilhada — Projeto #24`;

  const changed = currentRoute !== target;
  currentRoute = target;
  if (target === 'catalogo' && state.catalogDirty) loadCatalog();
  if (target === 'painel') renderPainel();
  if (focus && changed) {
    const heading = views[target].querySelector('h1');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: false }); }
  }
}

// ---------- ?login=ok / ?auth_error=… ----------
const AUTH_ERRORS = {
  access_denied: 'Você cancelou a autorização no Discord.',
  state_mismatch: 'A tentativa de login expirou ou veio de outra aba. Tente de novo.',
  invalid_state: 'A tentativa de login expirou ou veio de outra aba. Tente de novo.',
  not_configured: 'O login com Discord ainda não está configurado neste servidor.',
  missing_code: 'O Discord não devolveu a autorização. Tente entrar de novo.',
  token_exchange_failed: 'Não foi possível confirmar o login com o Discord. Tente de novo em instantes.',
  fetch_user_failed: 'Não foi possível ler seu perfil do Discord. Tente de novo em instantes.',
  server_error: 'Ocorreu um erro no servidor durante o login. Tente de novo em instantes.',
};

function readAuthParams() {
  const params = new URLSearchParams(location.search);
  const result = { loginOk: params.get('login') === 'ok', authError: null };
  if (params.has('auth_error')) {
    result.authError = (params.get('auth_error') || 'desconhecido').replace(/[^\w-]/g, '').slice(0, 60) || 'desconhecido';
  }
  if (params.has('login') || params.has('auth_error')) {
    params.delete('login');
    params.delete('auth_error');
    const qs = params.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  }
  return result;
}

// ---------- Inicialização ----------
async function start() {
  const auth = readAuthParams();
  initCatalog();
  initDashboard();
  on('user', () => {
    renderAuth();
    if (currentRoute === 'painel') renderPainel();
  });
  window.addEventListener('hashchange', () => route());

  route({ focus: false });
  loadCatalog();
  await loadMe();

  if (auth.authError) {
    const known = AUTH_ERRORS[auth.authError];
    toast(known || `Não foi possível entrar com o Discord (código: ${auth.authError}). Tente novamente.`, 'error');
  } else if (auth.loginOk) {
    toast(state.user
      ? `Login feito! Olá, ${state.user.display_name || handle(state.user)}.`
      : 'Login concluído, mas a sessão não foi encontrada. Tente entrar de novo.', state.user ? 'success' : 'error');
  }
}

start();
