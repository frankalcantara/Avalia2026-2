'use strict';

var MAX_LEN = 280;
var PAGE = 30;

var state = {
  me: null,
  users: [],
  filter: 'all',
  profile: '',
  lastId: null,
  loading: false
};

var el = {};

function $(id) { return document.getElementById(id); }

function make(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function showStatus(message, kind) {
  el.status.textContent = '';
  if (!message) return;
  el.status.appendChild(make('p', kind === 'ok' ? 'ok' : 'error', message));
}

async function api(path, options) {
  var opts = Object.assign({ credentials: 'same-origin' }, options || {});
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  }
  var res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    throw { status: 0, message: 'Não foi possível conectar ao servidor.' };
  }
  var data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    throw { status: res.status, message: (data && data.error) || 'Erro inesperado (' + res.status + ').' };
  }
  return data;
}

function relativeDate(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var diff = Math.round((Date.now() - d.getTime()) / 1000);
  if (diff < 45) return 'agora mesmo';
  var rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  var units = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]];
  var chosen = units[0];
  for (var i = 0; i < units.length; i++) {
    if (diff >= units[i][1]) chosen = units[i];
  }
  return rtf.format(-Math.floor(diff / chosen[1]), chosen[0]);
}

function avatarEl(user, size) {
  var img = make('img', 'avatar');
  img.alt = '';
  img.width = size;
  img.height = size;
  img.loading = 'lazy';
  if (user && user.avatar) img.src = user.avatar;
  return img;
}

function personEl(user) {
  var p = make('span', 'person');
  p.appendChild(avatarEl(user, 28));
  p.appendChild(make('span', null, user ? user.username : '?'));
  return p;
}

function cardEl(k) {
  var card = make('article', 'card');
  var badge = make('div', 'badge');
  var emoji = make('span', 'badge-emoji', k.badge_emoji || '⭐');
  emoji.setAttribute('aria-hidden', 'true');
  badge.appendChild(emoji);
  badge.appendChild(make('span', 'badge-label', k.badge_label || k.badge));
  card.appendChild(badge);
  card.appendChild(make('p', 'message', k.message));

  var route = make('div', 'route');
  route.appendChild(personEl(k.from));
  var arrow = make('span', 'arrow', '→');
  arrow.setAttribute('aria-label', 'para');
  route.appendChild(arrow);
  route.appendChild(personEl(k.to));
  card.appendChild(route);

  var time = make('time', 'date', relativeDate(k.created_at));
  time.dateTime = k.created_at;
  time.title = new Date(k.created_at).toLocaleString('pt-BR');
  card.appendChild(time);
  return card;
}

function fillSelect(select, items, placeholder, valueKey, labelFn) {
  select.textContent = '';
  if (placeholder) {
    var opt = make('option', null, placeholder);
    opt.value = '';
    select.appendChild(opt);
  }
  items.forEach(function (it) {
    var o = make('option', null, labelFn(it));
    o.value = it[valueKey];
    select.appendChild(o);
  });
}

function renderAuth() {
  var logged = !!state.me;
  el.login.hidden = logged;
  el.userBox.hidden = !logged;
  el.formSection.hidden = !logged;
  if (logged) {
    el.userName.textContent = state.me.username;
    if (state.me.avatar) el.userAvatar.src = state.me.avatar;
  }
  updateProfileControls();
}

function updateProfileControls() {
  var needsProfile = state.filter !== 'all';
  el.profileWrap.hidden = !needsProfile || !state.me;
}

function profileOptions() {
  var list = [];
  if (state.me) list.push({ id: state.me.id, username: state.me.username + ' (eu)' });
  state.users.forEach(function (u) { list.push(u); });
  return list;
}

async function loadKudos(append) {
  if (state.loading) return;
  var needsProfile = state.filter !== 'all';
  if (needsProfile && !state.profile) {
    el.grid.textContent = '';
    el.empty.hidden = false;
    el.empty.textContent = state.me
      ? 'Escolha um perfil para ver os kudos.'
      : 'Entre com o Discord para filtrar por perfil.';
    el.more.hidden = true;
    return;
  }
  state.loading = true;
  el.grid.setAttribute('aria-busy', 'true');
  var qs = new URLSearchParams({ filter: state.filter, limit: String(PAGE) });
  if (needsProfile) qs.set('user', state.profile);
  if (append && state.lastId) qs.set('before', String(state.lastId));
  try {
    var data = await api('/api/kudos?' + qs.toString());
    var list = (data && data.kudos) || [];
    if (!append) el.grid.textContent = '';
    list.forEach(function (k) { el.grid.appendChild(cardEl(k)); });
    if (list.length) state.lastId = list[list.length - 1].id;
    el.more.hidden = list.length < PAGE;
    el.empty.hidden = el.grid.children.length > 0;
    el.empty.textContent = 'Nenhum kudo por aqui ainda. Que tal começar elogiando alguém?';
  } catch (e) {
    showStatus(e.message, 'error');
  } finally {
    state.loading = false;
    el.grid.setAttribute('aria-busy', 'false');
  }
}

function setFilter(filter) {
  state.filter = filter;
  state.lastId = null;
  el.tabs.forEach(function (b) {
    var on = b.dataset.filter === filter;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  if (filter !== 'all' && !state.profile && state.me) {
    state.profile = state.me.id;
    el.profile.value = state.profile;
  }
  updateProfileControls();
  loadKudos(false);
}

function updateCounter() {
  var n = el.message.value.length;
  el.counter.textContent = n + '/' + MAX_LEN;
  el.counter.classList.toggle('near', n >= MAX_LEN - 20);
}

async function submitKudo(ev) {
  ev.preventDefault();
  showStatus('');
  var to = el.toUser.value;
  var badge = el.badge.value;
  var message = el.message.value.trim();
  if (!to || !badge) { showStatus('Escolha o destinatário e o selo.', 'error'); return; }
  if (!message) { showStatus('Escreva uma mensagem.', 'error'); return; }
  if (message.length > MAX_LEN) { showStatus('A mensagem deve ter no máximo ' + MAX_LEN + ' caracteres.', 'error'); return; }
  el.send.disabled = true;
  try {
    await api('/api/kudos', { method: 'POST', body: { to_user_id: to, badge: badge, message: message } });
    el.form.reset();
    updateCounter();
    showStatus('Kudo enviado! 🎉', 'ok');
    state.lastId = null;
    loadKudos(false);
  } catch (e) {
    if (e.status === 401) { state.me = null; renderAuth(); }
    showStatus(e.message, 'error');
  } finally {
    el.send.disabled = false;
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { showStatus(e.message, 'error'); return; }
  state.me = null;
  state.users = [];
  state.profile = '';
  renderAuth();
  setFilter('all');
}

async function loadSession() {
  try {
    var data = await api('/api/me');
    state.me = data.user;
  } catch (e) {
    state.me = null;
    if (e.status !== 401) showStatus(e.message, 'error');
  }
  if (state.me) {
    try {
      var u = await api('/api/users');
      state.users = (u && u.users) || [];
    } catch (e) {
      showStatus(e.message, 'error');
    }
    fillSelect(el.toUser, state.users, 'Selecione uma pessoa…', 'id', function (x) { return x.username; });
    fillSelect(el.profile, profileOptions(), null, 'id', function (x) { return x.username; });
    state.profile = state.me.id;
    el.profile.value = state.profile;
  }
  renderAuth();
}

async function loadBadges() {
  try {
    var data = await api('/api/badges');
    fillSelect(el.badge, (data && data.badges) || [], 'Selecione um selo…', 'id', function (b) { return b.emoji + ' ' + b.label; });
  } catch (e) {
    showStatus(e.message, 'error');
  }
}

function init() {
  el.status = $('status');
  el.login = $('login-btn');
  el.userBox = $('user-box');
  el.userName = $('user-name');
  el.userAvatar = $('user-avatar');
  el.logout = $('logout-btn');
  el.formSection = $('form-section');
  el.form = $('kudo-form');
  el.toUser = $('to-user');
  el.badge = $('badge');
  el.message = $('message');
  el.counter = $('counter');
  el.send = $('send-btn');
  el.grid = $('grid');
  el.empty = $('empty');
  el.more = $('more-btn');
  el.profile = $('profile');
  el.profileWrap = $('profile-wrap');
  el.tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));

  el.tabs.forEach(function (b) {
    b.addEventListener('click', function () { setFilter(b.dataset.filter); });
  });
  el.profile.addEventListener('change', function () {
    state.profile = el.profile.value;
    state.lastId = null;
    loadKudos(false);
  });
  el.message.addEventListener('input', updateCounter);
  el.form.addEventListener('submit', submitKudo);
  el.logout.addEventListener('click', logout);
  el.more.addEventListener('click', function () { loadKudos(true); });
  updateCounter();

  if (new URLSearchParams(location.search).get('erro') === 'login') {
    showStatus('Não foi possível entrar com o Discord. Tente novamente.', 'error');
  }

  loadSession().then(function () {
    loadBadges();
    loadKudos(false);
  });
}

document.addEventListener('DOMContentLoaded', init);
