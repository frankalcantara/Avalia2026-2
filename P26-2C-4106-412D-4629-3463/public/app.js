// Mural de Avisos — JavaScript puro (sem frameworks). Todo texto vindo do servidor entra no DOM via textContent.
const $ = (id) => document.getElementById(id);
const estado = { usuario: null, disciplinas: [], avisos: [], editando: null };

// ---------- utilidades ----------
function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null) el.append(f.nodeType ? f : document.createTextNode(String(f)));
  return el;
}

function mensagem(texto, ehErro = false) {
  const s = $('status');
  s.textContent = texto;
  s.classList.toggle('erro', ehErro);
}

async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const opcoes = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (corpo !== undefined) {
    opcoes.headers['content-type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  const res = await fetch(caminho, opcoes);
  const dados = await res.json().catch(() => ({}));
  if (res.status === 401) {
    mostrarLogin();
    throw new Error(dados.erro || 'Sessão expirada. Entre novamente.');
  }
  if (!res.ok) throw new Error(dados.erro || 'Algo deu errado. Tente novamente.');
  return dados;
}

const dataBR = (segundos) => new Date(segundos * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const prazoBR = (aaaammdd) => { const [a, m, d] = aaaammdd.split('-'); return `${d}/${m}/${a}`; };
const tentar = (fn) => async (...args) => { try { await fn(...args); } catch (e) { mensagem(e.message, true); } };

// ---------- telas ----------
function mostrarLogin() {
  estado.usuario = null;
  $('conta').hidden = true;
  $('tela-mural').hidden = true;
  $('tela-login').hidden = false;
}

function mostrarMural() {
  $('tela-login').hidden = true;
  $('tela-mural').hidden = false;
  $('conta').hidden = false;
  $('conta-avatar').src = estado.usuario.avatar;
  $('conta-nome').textContent = estado.usuario.nome;
}

// ---------- disciplinas ----------
function renderDisciplinas() {
  const lista = $('lista-disciplinas');
  lista.replaceChildren();
  if (!estado.disciplinas.length) {
    lista.append(h('li', {}, 'Nenhuma disciplina ainda. Crie a primeira abaixo.'));
  }
  for (const d of estado.disciplinas) {
    const btn = h('button', {
      type: 'button',
      class: d.inscrito ? 'secundario' : '',
      'aria-pressed': String(d.inscrito),
      onclick: tentar(() => alternarInscricao(d)),
    }, d.inscrito ? 'Deixar de seguir' : 'Seguir');
    lista.append(h('li', { class: d.inscrito ? 'seguindo' : '' },
      h('span', {}, h('strong', {}, d.codigo), h('span', { class: 'nome' }, d.nome)), btn));
  }

  const seletor = $('campo-disciplina');
  const atual = seletor.value;
  seletor.replaceChildren(...estado.disciplinas.map((d) => h('option', { value: d.codigo }, `${d.codigo} — ${d.nome}`)));
  if (atual) seletor.value = atual;

  const filtro = $('filtro-feed');
  const filtroAtual = filtro.value;
  filtro.replaceChildren(h('option', { value: '' }, 'Disciplinas que sigo'),
    ...estado.disciplinas.map((d) => h('option', { value: d.codigo }, d.codigo)));
  filtro.value = [...filtro.options].some((o) => o.value === filtroAtual) ? filtroAtual : '';
}

async function carregarDisciplinas() {
  estado.disciplinas = (await api('/api/disciplinas')).disciplinas;
  renderDisciplinas();
}

async function alternarInscricao(d) {
  await api(`/api/inscricoes/${encodeURIComponent(d.codigo)}`, { metodo: d.inscrito ? 'DELETE' : 'PUT' });
  mensagem(d.inscrito ? `Você deixou de seguir ${d.codigo}.` : `Agora você segue ${d.codigo}.`);
  await carregarDisciplinas();
  await carregarFeed();
}

// ---------- avisos ----------
function cartaDoAviso(a) {
  const meu = a.autor_id === estado.usuario.id;
  const rotulos = { aviso: 'Aviso', lembrete: 'Lembrete', link: 'Link' };
  const corpo = [];
  if (a.prazo) corpo.push(h('p', { class: 'prazo' }, `Entrega: ${prazoBR(a.prazo)}`));
  if (a.corpo) corpo.push(h('p', {}, a.corpo));
  if (a.url) corpo.push(h('p', {}, h('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.url)));

  const acoes = [
    h('button', { type: 'button', class: 'secundario', onclick: tentar(() => marcar(a, { lido: !a.lido })) },
      a.lido ? 'Marcar como não lido' : 'Marcar como lido'),
    h('button', { type: 'button', class: 'secundario', onclick: tentar(() => marcar(a, { fixado: !a.fixado })) },
      a.fixado ? 'Desafixar' : 'Fixar'),
  ];
  if (meu) {
    acoes.push(
      h('button', { type: 'button', class: 'secundario', onclick: () => iniciarEdicao(a) }, 'Editar'),
      h('button', { type: 'button', class: 'perigo', onclick: tentar(() => remover(a)) }, 'Remover'),
    );
  }

  return h('article', { class: `carta${a.fixado ? ' fixado' : ''}${a.lido ? ' lido' : ''}` },
    h('header', {},
      h('span', { class: 'etiqueta' }, a.disciplina),
      h('span', { class: 'etiqueta tipo' }, rotulos[a.tipo]),
      a.fixado ? h('span', {}, 'Fixado') : null,
      a.lido ? h('span', {}, 'Lido') : null),
    h('h3', {}, a.titulo),
    corpo,
    h('div', { class: 'autor' },
      h('img', { src: a.autor_avatar, alt: '', width: 24, height: 24, loading: 'lazy' }),
      h('span', {}, `${a.autor_nome} · ${dataBR(a.created_at)}${a.updated_at > a.created_at ? ' (editado)' : ''}`)),
    h('div', { class: 'rodape-carta' }, acoes));
}

function renderFeed() {
  const feed = $('feed');
  feed.replaceChildren();
  if (!estado.avisos.length) {
    feed.append(h('p', { class: 'vazio' }, $('filtro-feed').value
      ? 'Nenhum aviso nesta disciplina ainda. Publique o primeiro.'
      : 'Nada por aqui. Siga uma disciplina na lateral para ver os avisos dela.'));
    return;
  }
  feed.append(...estado.avisos.map(cartaDoAviso));
}

async function carregarFeed() {
  const disc = $('filtro-feed').value;
  const q = disc ? `?disciplina=${encodeURIComponent(disc)}` : '';
  estado.avisos = (await api(`/api/avisos${q}`)).avisos;
  renderFeed();
}

async function marcar(aviso, mudanca) {
  await api(`/api/avisos/${aviso.id}/estado`, { metodo: 'PUT', corpo: mudanca });
  await carregarFeed();
}

async function remover(aviso) {
  if (!confirm(`Remover o aviso "${aviso.titulo}"?`)) return;
  await api(`/api/avisos/${aviso.id}`, { metodo: 'DELETE' });
  if (estado.editando === aviso.id) sairDaEdicao();
  mensagem('Aviso removido.');
  await carregarFeed();
}

// ---------- formulário de aviso ----------
function ajustarCamposPorTipo() {
  const tipo = $('campo-tipo').value;
  $('rotulo-url').hidden = tipo !== 'link';
  $('rotulo-prazo').hidden = tipo !== 'lembrete';
  const f = $('form-aviso');
  f.elements.url.required = tipo === 'link';
  f.elements.prazo.required = tipo === 'lembrete';
  f.elements.corpo.required = tipo !== 'link';
}

function sairDaEdicao() {
  estado.editando = null;
  $('form-aviso').reset();
  $('titulo-form').textContent = 'Publicar aviso';
  $('btn-publicar').textContent = 'Publicar';
  $('btn-cancelar').hidden = true;
  ajustarCamposPorTipo();
}

function iniciarEdicao(a) {
  estado.editando = a.id;
  const f = $('form-aviso');
  f.elements.disciplina.value = a.disciplina;
  f.elements.tipo.value = a.tipo;
  f.elements.titulo.value = a.titulo;
  f.elements.corpo.value = a.corpo;
  f.elements.url.value = a.url || '';
  f.elements.prazo.value = a.prazo || '';
  ajustarCamposPorTipo();
  $('titulo-form').textContent = 'Editar aviso';
  $('btn-publicar').textContent = 'Salvar alterações';
  $('btn-cancelar').hidden = false;
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  f.elements.titulo.focus();
}

async function enviarAviso(ev) {
  ev.preventDefault();
  const f = ev.target;
  const corpo = {
    disciplina: f.elements.disciplina.value,
    tipo: f.elements.tipo.value,
    titulo: f.elements.titulo.value,
    corpo: f.elements.corpo.value,
    url: f.elements.url.value,
    prazo: f.elements.prazo.value,
  };
  if (estado.editando) {
    await api(`/api/avisos/${estado.editando}`, { metodo: 'PATCH', corpo });
    mensagem('Aviso atualizado.');
  } else {
    await api('/api/avisos', { metodo: 'POST', corpo });
    mensagem('Aviso publicado.');
  }
  sairDaEdicao();
  await carregarFeed();
}

async function criarDisciplina(ev) {
  ev.preventDefault();
  const f = ev.target;
  await api('/api/disciplinas', { metodo: 'POST', corpo: { codigo: f.elements.codigo.value, nome: f.elements.nome.value } });
  f.reset();
  mensagem('Disciplina criada e adicionada ao seu mural.');
  await carregarDisciplinas();
  await carregarFeed();
}

async function sair() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  mostrarLogin();
  mensagem('Você saiu.');
}

// ---------- início ----------
const ERROS_LOGIN = {
  negado: 'Login cancelado no Discord.',
  estado: 'Não foi possível validar o login. Tente entrar de novo.',
  token: 'O Discord recusou o login. Tente de novo.',
  perfil: 'Não foi possível ler seu perfil do Discord.',
  interno: 'Erro interno ao entrar. Tente de novo.',
};

async function iniciar() {
  $('btn-sair').addEventListener('click', tentar(sair));
  $('campo-tipo').addEventListener('change', ajustarCamposPorTipo);
  $('form-aviso').addEventListener('submit', tentar(enviarAviso));
  $('form-disciplina').addEventListener('submit', tentar(criarDisciplina));
  $('btn-cancelar').addEventListener('click', sairDaEdicao);
  $('filtro-feed').addEventListener('change', tentar(carregarFeed));
  ajustarCamposPorTipo();

  const erroLogin = new URLSearchParams(location.search).get('erro');
  if (erroLogin) {
    history.replaceState(null, '', '/');
    mensagem(ERROS_LOGIN[erroLogin] || 'Não foi possível entrar.', true);
  }

  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return mostrarLogin();
    estado.usuario = (await res.json()).usuario;
    mostrarMural();
    await carregarDisciplinas();
    await carregarFeed();
  } catch {
    mostrarLogin();
    mensagem('Não foi possível conectar ao servidor.', true);
  }
}

iniciar();
