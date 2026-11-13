// Estado e telas da Vitrine de Achados e Perdidos do Campus.
// Contrato: docs/ESPECIFICACAO.md. O servidor é a fonte da verdade: a interface só ajuda
// a validar e sempre mostra a mensagem de erro que ele devolver.

import { api } from './api.js';
import {
  el, icone, avatar, nomeDe, CATEGORIAS, TIPOS, categoria, tileCategoria, iconeCategoria,
  seloTipo, seloStatus, seloReiv, formatarDia, tempo, dataHoraCompleta, hojeISO, umAnoAtrasISO,
  avisar, confirmar, copiar, debounce, ligarContador, validarAparado, ocupado, plural,
  mostrarErroCampo, validarNoCampo, ligarValidacaoNoCampo, limparErrosCampos,
} from './ui.js';

const $ = (id) => document.getElementById(id);
const POR_PAGINA = 12;
const LOGIN_URL = '/api/auth/discord';

const FILTROS_PADRAO = Object.freeze({
  tipo: '', categoria: '', status: '', q: '', local: '', de: '', ate: '', ordem: 'recentes',
});
const VALIDOS = {
  tipo: Object.keys(TIPOS),
  categoria: Object.keys(CATEGORIAS),
  status: ['aberto', 'em_devolucao', 'encerrado', 'todos'],
  ordem: ['recentes', 'antigos'],
};
const VISOES = ['vitrine', 'meus', 'reivindicacoes'];
// Nome de cada campo nas mensagens de erro ("Preencha o título.", "Escolha uma categoria.").
const NOMES_CAMPOS = {
  tipo: 'se você perdeu ou encontrou', categoria: 'uma categoria', titulo: 'o título', descricao: 'a descrição',
  local: 'o local', data_ocorrencia: 'a data', mensagem: 'a mensagem',
};
const ABA_DA_VISAO = { vitrine: 'abaVitrine', meus: 'abaMeus', reivindicacoes: 'abaReivs' };

const estado = {
  usuario: null,
  ver: 'vitrine',
  filtros: { ...FILTROS_PADRAO },
  pagina: 1,
  total: 0,
  itens: [],
  controlador: null,
  reivs: null,
  detalheId: null,
};

const ERROS_LOGIN = {
  negado: 'Você cancelou ou negou a autorização no Discord.',
  state_invalido: 'O login expirou ou foi aberto em outra aba. Tente entrar de novo.',
  oauth_nao_configurado: 'O login com Discord ainda não está configurado neste servidor.',
  troca_falhou: 'O Discord não confirmou o login. Tente entrar de novo.',
  perfil_falhou: 'Não conseguimos ler seu perfil do Discord. Tente entrar de novo.',
  interno: 'Erro interno ao entrar. Tente de novo em instantes.',
};

// ======================================================================
// URL <-> estado
// ======================================================================
function lerUrl() {
  const p = new URLSearchParams(location.search);
  const f = { ...FILTROS_PADRAO };
  for (const k of ['tipo', 'categoria', 'status', 'ordem']) {
    const v = p.get(k);
    if (v && VALIDOS[k].includes(v)) f[k] = v;
  }
  f.q = (p.get('q') ?? '').slice(0, 60);
  f.local = (p.get('local') ?? '').slice(0, 120);
  for (const k of ['de', 'ate']) {
    const v = p.get(k) ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) f[k] = v;
  }
  estado.filtros = f;
  const ver = p.get('ver');
  estado.ver = VISOES.includes(ver) ? ver : 'vitrine';
  const item = Number.parseInt(p.get('item') ?? '', 10);
  return {
    login: p.get('login'),
    erroLogin: p.get('erro_login'),
    item: Number.isSafeInteger(item) && item > 0 ? item : null,
  };
}

function escreverUrl() {
  const p = new URLSearchParams();
  if (estado.ver !== 'vitrine') p.set('ver', estado.ver);
  for (const [k, v] of Object.entries(estado.filtros)) {
    if (v && v !== FILTROS_PADRAO[k]) p.set(k, v);
  }
  if (estado.detalheId) p.set('item', String(estado.detalheId));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}

function mensagemErroLogin(codigo) {
  if (ERROS_LOGIN[codigo]) return ERROS_LOGIN[codigo];
  const limpo = /^[a-z0-9_-]{1,40}$/i.test(codigo) ? ` (código: ${codigo})` : '';
  return `Não foi possível entrar com o Discord${limpo}. Tente de novo.`;
}

const idSeguro = (v) => {
  const n = Number.parseInt(String(v), 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

// ======================================================================
// Sessão
// ======================================================================
async function carregarUsuario() {
  try {
    const r = await api.me();
    estado.usuario = r?.usuario ?? null;
  } catch {
    estado.usuario = null;
  }
  renderPerfil();
}

function renderPerfil() {
  const u = estado.usuario;
  const logado = Boolean(u);
  $('btnEntrar').hidden = logado;
  $('ctaEntrar').hidden = logado;
  $('perfil').hidden = !logado;
  $('btnCadastrar').hidden = !logado;
  $('abaMeus').hidden = !logado;
  $('abaReivs').hidden = !logado;
  atualizarFab();
  if (logado) {
    $('perfilAvatar').replaceChildren(avatar(u, 'avatar avatar--m'));
    $('perfilNome').textContent = nomeDe(u);
    $('perfil').title = u.username ? `@${u.username}` : '';
  } else {
    $('perfilAvatar').replaceChildren();
    $('perfilNome').textContent = '';
    estado.reivs = null;
    atualizarBadge();
  }
}

function sessaoExpirou() {
  estado.usuario = null;
  renderPerfil();
  if (estado.ver !== 'vitrine') trocarVisao('vitrine');
  avisar('Sua sessão expirou. Entre de novo com o Discord.', 'erro', 8000);
}

/** Trata erro de ação: 401 derruba a sessão; demais viram aviso. */
function falhou(e, alvo) {
  if (e?.status === 401) { sessaoExpirou(); return; }
  if (alvo) {
    alvo.textContent = e?.message ?? 'Erro inesperado.';
    alvo.hidden = false;
  } else {
    avisar(e?.message ?? 'Erro inesperado.', 'erro', 7000);
  }
}

async function sair() {
  const btn = $('btnSair');
  ocupado(btn, true);
  try {
    await api.sair();
  } catch (e) {
    if (e?.status !== 401) { avisar(e.message, 'erro'); ocupado(btn, false); return; }
  }
  ocupado(btn, false);
  estado.usuario = null;
  renderPerfil();
  avisar('Você saiu da sua conta.', 'info');
  trocarVisao('vitrine');
}

// ======================================================================
// Abas / visões
// ======================================================================
function trocarVisao(ver, { focar = false } = {}) {
  if (!VISOES.includes(ver)) ver = 'vitrine';
  if (ver !== 'vitrine' && !estado.usuario) ver = 'vitrine';
  estado.ver = ver;
  for (const [v, idAba] of Object.entries(ABA_DA_VISAO)) {
    const aba = $(idAba);
    const ativa = v === ver;
    aba.setAttribute('aria-selected', String(ativa));
    aba.tabIndex = ativa ? 0 : -1;
    if (ativa && focar) aba.focus();
  }
  const emReivs = ver === 'reivindicacoes';
  $('painelItens').hidden = emReivs;
  $('painelReivs').hidden = !emReivs;
  $('painelItens').setAttribute('aria-labelledby', ABA_DA_VISAO[ver === 'meus' ? 'meus' : 'vitrine']);
  atualizarFab();
  escreverUrl();
  if (emReivs) carregarReivs(true);
  else carregarItens();
}

function ligarAbas() {
  const abas = [...document.querySelectorAll('.abas [role="tab"]')];
  for (const aba of abas) {
    aba.addEventListener('click', () => trocarVisao(aba.dataset.ver));
    aba.addEventListener('keydown', (e) => {
      const visiveis = abas.filter((a) => !a.hidden);
      const i = visiveis.indexOf(aba);
      let alvo = null;
      if (e.key === 'ArrowRight') alvo = visiveis[(i + 1) % visiveis.length];
      else if (e.key === 'ArrowLeft') alvo = visiveis[(i - 1 + visiveis.length) % visiveis.length];
      else if (e.key === 'Home') alvo = visiveis[0];
      else if (e.key === 'End') alvo = visiveis[visiveis.length - 1];
      if (alvo) {
        e.preventDefault();
        trocarVisao(alvo.dataset.ver, { focar: true });
      }
    });
  }
}

function atualizarFab() {
  $('fab').hidden = !estado.usuario || estado.ver === 'reivindicacoes';
}

// ======================================================================
// Filtros
// ======================================================================
function montarChips() {
  const chipsTipo = [
    { valor: '', rotulo: 'Todos' },
    ...Object.entries(TIPOS).map(([valor, t]) => ({ valor, rotulo: t.rotulo })),
  ].map(({ valor, rotulo }) => el('button', {
    type: 'button',
    class: ['chip', valor && `chip--${valor}`],
    'aria-pressed': 'false',
    dataset: { campo: 'tipo', valor },
  }, valor ? icone(TIPOS[valor].icone, `ico chip-ico chip-ico--${valor}`) : null,
  el('span', {}, rotulo), el('span', { class: 'chip-qtd', dataset: { qtdTipo: valor } })));

  const chipsCat = [
    el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { campo: 'categoria', valor: '' } },
      el('span', {}, 'Todas'), el('span', { class: 'chip-qtd', dataset: { qtdCat: '' } })),
    ...Object.entries(CATEGORIAS).map(([valor, c]) => el('button', {
      type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { campo: 'categoria', valor },
    }, iconeCategoria(valor, 'ico chip-ico'), el('span', {}, c.rotulo),
    el('span', { class: 'chip-qtd', dataset: { qtdCat: valor } }))),
  ];

  $('chipsTipo').replaceChildren(...chipsTipo);
  $('chipsCategoria').replaceChildren(...chipsCat);

  for (const chip of document.querySelectorAll('#filtros .chip')) {
    chip.addEventListener('click', () => {
      const { campo, valor } = chip.dataset;
      estado.filtros[campo] = estado.filtros[campo] === valor ? '' : valor;
      mudouFiltro();
    });
  }
}

function atualizarChips() {
  for (const chip of document.querySelectorAll('#filtros .chip')) {
    const { campo, valor } = chip.dataset;
    chip.setAttribute('aria-pressed', String(estado.filtros[campo] === valor));
  }
}

function atualizarContagens(contagens) {
  const porTipo = contagens?.por_tipo;
  const porCat = contagens?.por_categoria;
  const soma = (o) => Object.values(o).reduce((a, n) => a + (Number(n) || 0), 0);
  for (const s of document.querySelectorAll('[data-qtd-tipo]')) {
    const v = s.dataset.qtdTipo;
    const n = porTipo && typeof porTipo === 'object' ? (v ? Number(porTipo[v]) || 0 : soma(porTipo)) : null;
    s.textContent = n === null ? '' : String(n);
    s.hidden = n === null;
  }
  for (const s of document.querySelectorAll('[data-qtd-cat]')) {
    const v = s.dataset.qtdCat;
    const n = porCat && typeof porCat === 'object' ? (v ? Number(porCat[v]) || 0 : soma(porCat)) : null;
    s.textContent = n === null ? '' : String(n);
    s.hidden = n === null;
  }
}

function preencherCamposFiltro() {
  const f = estado.filtros;
  $('fQ').value = f.q;
  $('fLocal').value = f.local;
  $('fStatus').value = f.status;
  $('fOrdem').value = f.ordem;
  $('fDe').value = f.de;
  $('fAte').value = f.ate;
  limitesDatasFiltro();
  atualizarChips();
  atualizarQtdFiltros();
}

function limitesDatasFiltro() {
  const hoje = hojeISO();
  $('fDe').max = estado.filtros.ate || hoje;
  $('fAte').max = hoje;
  if (estado.filtros.de) $('fAte').min = estado.filtros.de;
  else $('fAte').removeAttribute('min');
}

function filtrosAtivos() {
  return Object.entries(estado.filtros).filter(([k, v]) => v && v !== FILTROS_PADRAO[k]).length;
}

function atualizarQtdFiltros() {
  const f = estado.filtros;
  const avancados = ['status', 'local', 'de', 'ate'].filter((k) => f[k]).length + (f.ordem !== 'recentes' ? 1 : 0);
  const b = $('qtdFiltros');
  b.textContent = String(avancados);
  b.hidden = avancados === 0;
}

function mudouFiltro() {
  atualizarChips();
  atualizarQtdFiltros();
  limitesDatasFiltro();
  escreverUrl();
  if (estado.ver !== 'reivindicacoes') carregarItens();
}

function limparFiltros() {
  estado.filtros = { ...FILTROS_PADRAO };
  preencherCamposFiltro();
  mudouFiltro();
}

function ligarFiltros() {
  $('filtros').addEventListener('submit', (e) => e.preventDefault());

  const aplicarTexto = debounce(() => {
    const q = $('fQ').value.trim().slice(0, 60);
    const local = $('fLocal').value.trim().slice(0, 120);
    if (q === estado.filtros.q && local === estado.filtros.local) return;
    estado.filtros.q = q;
    estado.filtros.local = local;
    mudouFiltro();
  }, 250);
  $('fQ').addEventListener('input', aplicarTexto);
  $('fLocal').addEventListener('input', aplicarTexto);

  $('fStatus').addEventListener('change', (e) => { estado.filtros.status = e.target.value; mudouFiltro(); });
  $('fOrdem').addEventListener('change', (e) => { estado.filtros.ordem = e.target.value; mudouFiltro(); });

  const aplicarDatas = () => {
    let de = $('fDe').value;
    let ate = $('fAte').value;
    if (de && ate && de > ate) {
      [de, ate] = [ate, de];
      $('fDe').value = de;
      $('fAte').value = ate;
    }
    estado.filtros.de = de;
    estado.filtros.ate = ate;
    mudouFiltro();
  };
  $('fDe').addEventListener('change', aplicarDatas);
  $('fAte').addEventListener('change', aplicarDatas);

  $('btnLimpar').addEventListener('click', limparFiltros);

  $('btnMaisFiltros').addEventListener('click', () => {
    const btn = $('btnMaisFiltros');
    const abrir = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(abrir));
    $('filtrosAvancados').classList.toggle('aberto', abrir);
  });

  // Atalho "/" foca a busca (fora de campos de texto).
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const alvo = e.target;
    if (alvo instanceof HTMLElement && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
    if (document.querySelector('dialog[open]') || $('painelItens').hidden) return;
    e.preventDefault();
    $('fQ').focus();
  });
}

// ======================================================================
// Lista de itens
// ======================================================================
function esqueletos(n) {
  return Array.from({ length: n }, () => el('div', { class: 'cartao cartao--esqueleto', 'aria-hidden': 'true' },
    el('div', { class: 'esq-topo' }, el('span', { class: 'esq esq--tile' }), el('span', { class: 'esq esq--selo' })),
    el('span', { class: 'esq esq--linha esq--curta' }),
    el('span', { class: 'esq esq--titulo' }),
    el('span', { class: 'esq esq--linha' }),
    el('span', { class: 'esq esq--linha esq--media' }),
    el('div', { class: 'esq-rodape' }, el('span', { class: 'esq esq--avatar' }), el('span', { class: 'esq esq--linha esq--curta' }))));
}

async function carregarItens(anexar = false) {
  estado.controlador?.abort();
  const ctrl = new AbortController();
  estado.controlador = ctrl;

  const pagina = anexar ? estado.pagina + 1 : 1;
  const params = { ...estado.filtros, pagina, por_pagina: POR_PAGINA };
  if (params.ordem === FILTROS_PADRAO.ordem) delete params.ordem;
  if (estado.ver === 'meus') params.meus = '1';

  const grade = $('grade');
  const btnMais = $('btnMais');
  if (anexar) {
    ocupado(btnMais, true);
  } else {
    grade.setAttribute('aria-busy', 'true');
    grade.replaceChildren(...esqueletos(6));
    $('estadoLista').replaceChildren();
    btnMais.hidden = true;
    $('mostrando').textContent = '';
    $('resumo').textContent = 'Carregando itens…';
  }

  try {
    const r = await api.listarItens(params, ctrl.signal);
    if (estado.controlador !== ctrl) return;
    const novos = Array.isArray(r?.itens) ? r.itens : [];
    estado.pagina = Number(r?.pagina) || pagina;
    estado.total = Number(r?.total) || 0;
    estado.itens = anexar ? estado.itens.concat(novos) : novos;
    if (r?.contagens) atualizarContagens(r.contagens);

    const cartoes = novos.map(cartaoItem);
    if (anexar) {
      grade.append(...cartoes);
      cartoes[0]?.querySelector('.cartao-link')?.focus();
    } else {
      grade.replaceChildren(...cartoes);
      if (novos.length === 0) mostrarVazio();
    }
    atualizarResumo();
    const restam = estado.total - estado.itens.length;
    btnMais.hidden = restam <= 0 || novos.length === 0;
    btnMais.textContent = `Carregar mais (${Math.max(restam, 0)})`;
  } catch (e) {
    if (e?.name === 'AbortError') return;
    if (estado.controlador !== ctrl) return;
    if (e?.status === 401 && estado.ver === 'meus') { estado.controlador = null; sessaoExpirou(); return; }
    if (anexar) {
      falhou(e);
    } else {
      grade.replaceChildren();
      $('resumo').textContent = '';
      mostrarErroLista(e);
    }
  } finally {
    if (estado.controlador === ctrl) {
      estado.controlador = null;
      grade.setAttribute('aria-busy', 'false');
      ocupado(btnMais, false);
    }
  }
}

function atualizarResumo() {
  const n = estado.total;
  const onde = estado.ver === 'meus' ? ' entre os seus' : '';
  $('resumo').textContent = n === 0 ? '' : `${plural(n, 'item encontrado', 'itens encontrados')}${onde}`;
  $('mostrando').textContent = estado.itens.length && n > estado.itens.length
    ? `Mostrando ${estado.itens.length} de ${n}` : '';
}

function blocoEstado({ iconeNome, titulo, texto, acoes = [] }) {
  return el('div', { class: 'estado' },
    el('span', { class: 'estado-ico' }, icone(iconeNome)),
    el('h2', { class: 'estado-titulo' }, titulo),
    texto ? el('p', { class: 'estado-texto' }, texto) : null,
    acoes.length ? el('div', { class: 'estado-acoes' }, ...acoes) : null);
}

function mostrarVazio() {
  const acoes = [];
  let titulo;
  let texto;
  if (filtrosAtivos() > 0) {
    titulo = 'Nada encontrado com esses filtros';
    texto = 'Tente outra palavra, outra categoria ou amplie o período. Itens encerrados ficam escondidos por padrão.';
    acoes.push(el('button', { type: 'button', class: 'btn btn--secundario', onclick: limparFiltros }, icone('x'), 'Limpar filtros'));
  } else if (estado.ver === 'meus') {
    titulo = 'Você ainda não cadastrou nenhum item';
    texto = 'Perdeu ou encontrou alguma coisa? Publique aqui para a comunidade ajudar.';
  } else {
    titulo = 'Nenhum item publicado por enquanto';
    texto = 'Que bom: ninguém perdeu nada! Se você encontrou ou perdeu algo, seja o primeiro a publicar.';
  }
  if (estado.usuario) {
    acoes.push(el('button', { type: 'button', class: 'btn btn--primario', onclick: abrirNovo }, icone('mais'), 'Cadastrar item'));
  } else if (filtrosAtivos() === 0) {
    acoes.push(el('a', { class: 'btn btn--discord', href: LOGIN_URL }, icone('discord'), 'Entrar com Discord'));
  }
  $('estadoLista').replaceChildren(blocoEstado({ iconeNome: 'caixa', titulo, texto, acoes }));
}

function mostrarErroLista(e) {
  $('estadoLista').replaceChildren(blocoEstado({
    iconeNome: 'recarregar',
    titulo: 'Não conseguimos carregar os itens',
    texto: e?.message ?? 'Erro inesperado.',
    acoes: [el('button', { type: 'button', class: 'btn btn--primario', onclick: () => carregarItens() }, icone('recarregar'), 'Tentar de novo')],
  }));
}

function linkItem(id, texto, classe) {
  const n = idSeguro(id);
  if (!n) return el('span', { class: classe }, texto);
  return el('a', {
    href: `?item=${n}`,
    class: classe,
    onclick: (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      abrirDetalhe(n);
    },
  }, texto);
}

function autorMini(autor, sufixo) {
  return el('span', { class: 'autor' }, avatar(autor, 'avatar avatar--p'),
    el('span', { class: 'autor-nome' }, nomeDe(autor)), sufixo ? el('span', { class: 'voce' }, sufixo) : null);
}

function cartaoItem(item) {
  const cat = categoria(item.categoria);
  const meu = estado.usuario && item.autor?.user_id === estado.usuario.user_id;
  const n = Number(item.total_reivindicacoes) || 0;
  return el('article', { class: ['cartao', `cartao--${TIPOS[item.tipo] ? item.tipo : 'neutro'}`, item.status === 'encerrado' && 'cartao--encerrado'] },
    el('div', { class: 'cartao-topo' },
      tileCategoria(item.categoria),
      el('div', { class: 'cartao-selos' }, seloTipo(item.tipo), item.status !== 'aberto' ? seloStatus(item.status) : null)),
    el('p', { class: 'cartao-cat' }, cat.rotulo),
    el('h3', { class: 'cartao-titulo' }, linkItem(item.id, item.titulo ?? '', 'cartao-link')),
    el('p', { class: 'cartao-desc' }, item.descricao ?? ''),
    el('ul', { class: 'meta' },
      el('li', {}, icone('pin'), el('span', {}, item.local ?? '')),
      el('li', {}, icone('calendario'), el('time', { datetime: item.data_ocorrencia ?? '' }, formatarDia(item.data_ocorrencia)))),
    el('div', { class: 'cartao-rodape' },
      autorMini(item.autor, meu ? 'você' : null),
      el('span', { class: ['qtd-reivs', n > 0 && 'qtd-reivs--tem'], title: plural(n, 'reivindicação', 'reivindicações') },
        icone('conversa'), el('span', { class: 'sr-only' }, 'Reivindicações: '), String(n))));
}

// ======================================================================
// Cadastro de item
// ======================================================================
function configurarDatasNovo() {
  const campo = $('nData');
  campo.max = hojeISO();
  campo.min = umAnoAtrasISO();
  if (!campo.value) campo.value = campo.max;
}

function abrirNovo() {
  if (!estado.usuario) { location.assign(LOGIN_URL); return; }
  configurarDatasNovo();
  $('novoErro').hidden = true;
  limparErrosCampos($('formNovo'));
  const dlg = $('dlgNovo');
  if (!dlg.open) dlg.showModal();
  const marcado = dlg.querySelector('input[name="tipo"]:checked');
  (marcado ?? dlg.querySelector('input[name="tipo"]')).focus();
}

function ligarNovo() {
  const form = $('formNovo');
  const contadores = [
    ligarContador($('nTitulo'), $('cTitulo')),
    ligarContador($('nDescricao'), $('cDescricao')),
    ligarContador($('nLocal'), $('cLocal')),
  ];
  $('btnCadastrar').addEventListener('click', abrirNovo);
  $('fab').addEventListener('click', abrirNovo);
  ligarValidacaoNoCampo(form, NOMES_CAMPOS);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('novoErro');
    erro.hidden = true;
    for (const id of ['nTitulo', 'nDescricao', 'nLocal']) validarAparado($(id));
    configurarDatasNovo();
    const invalido = validarNoCampo(form, NOMES_CAMPOS);
    if (invalido) { invalido.focus(); return; }

    const fd = new FormData(form);
    const dados = {
      tipo: String(fd.get('tipo') ?? ''),
      categoria: String(fd.get('categoria') ?? ''),
      titulo: String(fd.get('titulo') ?? '').trim(),
      descricao: String(fd.get('descricao') ?? '').trim(),
      local: String(fd.get('local') ?? '').trim(),
      data_ocorrencia: String(fd.get('data_ocorrencia') ?? ''),
    };
    const btn = $('novoEnviar');
    ocupado(btn, true);
    try {
      const r = await api.criarItem(dados);
      form.reset();
      limparErrosCampos(form);
      contadores.forEach((f) => f());
      $('dlgNovo').close();
      avisar('Item publicado na vitrine!', 'sucesso');
      const novoId = idSeguro(r?.item?.id ?? r?.id);
      if (estado.ver === 'reivindicacoes') trocarVisao('vitrine');
      else carregarItens();
      if (novoId) abrirDetalhe(novoId);
    } catch (err) {
      if (err?.status === 401) { $('dlgNovo').close(); sessaoExpirou(); return; }
      falhou(err, erro);
      mostrarErrosCampos(form, err?.campos);
      erro.scrollIntoView({ block: 'nearest' });
    } finally {
      ocupado(btn, false);
    }
  });
}

/** Mostra { campo: "mensagem" } (400 do servidor) logo abaixo de cada campo do formulário. */
function mostrarErrosCampos(form, campos) {
  if (!campos || typeof campos !== 'object') return;
  let primeiro = null;
  for (const [nome, msg] of Object.entries(campos)) {
    const ctrl = form.elements.namedItem(nome);
    if (!ctrl) continue;
    primeiro ??= mostrarErroCampo(ctrl, msg);
  }
  primeiro?.focus();
}

// ======================================================================
// Normalização das respostas de reivindicação (tolerante a pequenas variações)
// ======================================================================
function pessoaReivindicante(r) {
  if (r?.reivindicante && typeof r.reivindicante === 'object') return r.reivindicante;
  return {
    user_id: r?.reivindicante_id,
    username: r?.reivindicante_username ?? r?.contato_reivindicante,
    nome_exibicao: r?.reivindicante_nome ?? r?.reivindicante_nome_exibicao,
    avatar_url: r?.reivindicante_avatar ?? r?.reivindicante_avatar_url,
  };
}

function idReivindicante(r) {
  return r?.reivindicante?.user_id ?? r?.reivindicante_id ?? null;
}

function itemDaReiv(r) {
  if (r?.item && typeof r.item === 'object') {
    const it = r.item;
    if (it.autor) return it;
    return { ...it, autor: it.autor_id && r.contato_autor ? { user_id: it.autor_id, username: r.contato_autor } : null };
  }
  return {
    id: r?.item_id,
    titulo: r?.item_titulo ?? r?.titulo,
    tipo: r?.item_tipo ?? r?.tipo,
    categoria: r?.item_categoria ?? r?.categoria,
    status: r?.item_status,
    autor: r?.autor ?? (r?.autor_id ? { user_id: r.autor_id, username: r.contato_autor } : null),
  };
}

const ATIVA = (r) => r?.status === 'pendente' || r?.status === 'aceita';

function normalizarDetalhe(d) {
  const item = d?.item && typeof d.item === 'object' ? d.item : d;
  let reivs = d?.reivindicacoes ?? item?.reivindicacoes ?? [];
  if (!Array.isArray(reivs)) reivs = [];
  const eu = estado.usuario?.user_id;
  const souAutor = Boolean(eu) && item?.autor?.user_id === eu;
  let minha = d?.minha_reivindicacao ?? item?.minha_reivindicacao ?? null;
  if (!minha && eu && !souAutor) {
    const minhas = reivs.filter((r) => idReivindicante(r) === eu || idReivindicante(r) === null);
    minha = minhas.find(ATIVA) ?? minhas[0] ?? null;
  }
  // `permissoes` do servidor decide os botões; o cálculo local é só reserva.
  const p = d?.permissoes && typeof d.permissoes === 'object' ? d.permissoes : null;
  const autorFinal = p ? Boolean(p.eh_autor) : souAutor;
  const st = item?.status;
  const temPendente = autorFinal && reivs.some((r) => r.status === 'pendente');
  const perm = p
    ? { reivindicar: Boolean(p.pode_reivindicar), encerrar: Boolean(p.pode_encerrar), apagar: Boolean(p.pode_apagar) }
    : {
      reivindicar: Boolean(eu) && !autorFinal && st === 'aberto' && !(minha && ATIVA(minha)),
      encerrar: (autorFinal && (st === 'em_devolucao' || (st === 'aberto' && !temPendente)))
        || (minha?.status === 'aceita' && st === 'em_devolucao'),
      apagar: autorFinal && st === 'aberto',
    };
  return { item, reivs: autorFinal ? reivs : [], minha: autorFinal ? null : minha, souAutor: autorFinal, perm, temPendente };
}

// ======================================================================
// Detalhe do item
// ======================================================================
function cabecalhoDetalhe(titulo, item) {
  return el('header', { class: 'dlg-cabecalho' },
    el('div', { class: 'det-cabecalho' },
      item ? tileCategoria(item.categoria, 'cat-tile--g') : null,
      el('div', {},
        item ? el('div', { class: 'det-selos' }, seloTipo(item.tipo), seloStatus(item.status)) : null,
        el('h2', { id: 'detTitulo', class: 'det-titulo' }, titulo))),
    el('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Fechar', onclick: () => $('dlgDetalhe').close() }, icone('x')));
}

async function abrirDetalhe(id) {
  const n = idSeguro(id);
  if (!n) return;
  estado.detalheId = n;
  escreverUrl();
  const dlg = $('dlgDetalhe');
  $('detConteudo').replaceChildren(
    cabecalhoDetalhe('Carregando…', null),
    el('div', { class: 'dlg-corpo' }, el('div', { class: 'esq esq--bloco', 'aria-hidden': 'true' }), el('span', { class: 'esq esq--linha' }), el('span', { class: 'esq esq--linha esq--media' })));
  if (!dlg.open) dlg.showModal();
  await carregarDetalhe(n);
}

async function carregarDetalhe(id) {
  try {
    const d = await api.obterItem(id);
    if (estado.detalheId !== id) return;
    renderDetalhe(normalizarDetalhe(d));
  } catch (e) {
    if (estado.detalheId !== id) return;
    $('detConteudo').replaceChildren(
      cabecalhoDetalhe(e?.status === 404 ? 'Item não encontrado' : 'Não foi possível abrir o item', null),
      el('div', { class: 'dlg-corpo' }, blocoEstado({
        iconeNome: e?.status === 404 ? 'caixa' : 'recarregar',
        titulo: e?.status === 404 ? 'Ele pode ter sido apagado pelo autor.' : 'Algo deu errado.',
        texto: e?.message,
        acoes: e?.status === 404 ? [] : [el('button', { type: 'button', class: 'btn btn--primario', onclick: () => carregarDetalhe(id) }, icone('recarregar'), 'Tentar de novo')],
      })));
  }
}

/** Executa uma ação de botão com estado ocupado, aviso de sucesso e recarga do que estiver na tela. */
async function executar(botao, acao, sucesso) {
  ocupado(botao, true);
  try {
    await acao();
    avisar(sucesso, 'sucesso');
    await recarregarTudo();
  } catch (e) {
    falhou(e);
    if (e?.status === 409 || e?.status === 404) await recarregarTudo();
  } finally {
    if (botao.isConnected) ocupado(botao, false);
  }
}

async function recarregarTudo() {
  const tarefas = [];
  if (estado.detalheId && $('dlgDetalhe').open) tarefas.push(carregarDetalhe(estado.detalheId));
  if (estado.usuario) tarefas.push(carregarReivs(false)); // re-renderiza o painel se ele estiver aberto
  if (estado.ver !== 'reivindicacoes') tarefas.push(carregarItens());
  await Promise.allSettled(tarefas);
}

// ----- ações (com confirmação) -----
async function acaoAceitar(r, botao) {
  const ok = await confirmar({
    titulo: 'Aceitar esta reivindicação?',
    texto: 'O item passa para "em devolução" e vocês dois passam a ver o contato do Discord um do outro para combinar a entrega. As outras reivindicações ficam aguardando até o caso ser encerrado.',
    botao: 'Aceitar',
  });
  if (ok) await executar(botao, () => api.aceitar(r.id), 'Reivindicação aceita. Combine a devolução pelo Discord.');
}

async function acaoRecusar(r, botao) {
  const ok = await confirmar({ titulo: 'Recusar esta reivindicação?', texto: 'A pessoa verá que a reivindicação foi recusada.', botao: 'Recusar', perigo: true });
  if (ok) await executar(botao, () => api.recusar(r.id), 'Reivindicação recusada.');
}

async function acaoCancelar(r, botao, souAutor) {
  const aceita = r.status === 'aceita';
  const ok = await confirmar({
    titulo: souAutor ? 'Desfazer o aceite?' : 'Cancelar sua reivindicação?',
    texto: aceita ? 'O item volta a ficar aberto para outras reivindicações.' : 'Você pode reivindicar de novo depois, se o item continuar aberto.',
    botao: souAutor ? 'Desfazer aceite' : 'Cancelar reivindicação',
    perigo: true,
  });
  if (ok) await executar(botao, () => api.cancelar(r.id), souAutor ? 'Aceite desfeito. O item voltou a ficar aberto.' : 'Reivindicação cancelada.');
}

async function acaoEncerrar(itemId, statusItem, botao) {
  const devolucao = statusItem === 'em_devolucao';
  const ok = await confirmar({
    titulo: devolucao ? 'Confirmar a devolução?' : 'Encerrar este item?',
    texto: devolucao
      ? 'O caso será encerrado: a reivindicação aceita vira "concluída" e as pendentes são recusadas. Isso não pode ser desfeito.'
      : 'Use quando o caso foi resolvido por fora. O item sai da vitrine e isso não pode ser desfeito.',
    botao: devolucao ? 'Marcar como devolvido' : 'Encerrar item',
  });
  if (ok) await executar(botao, () => api.encerrarItem(itemId), devolucao ? 'Caso encerrado. Obrigado por devolver!' : 'Item encerrado.');
}

async function acaoApagar(item, botao) {
  const ok = await confirmar({ titulo: 'Apagar este item?', texto: 'Ele sai da vitrine de vez, junto com as reivindicações pendentes. Não dá para desfazer.', botao: 'Apagar', perigo: true });
  if (!ok) return;
  ocupado(botao, true);
  try {
    await api.apagarItem(item.id);
    $('dlgDetalhe').close();
    avisar('Item apagado.', 'sucesso');
    await recarregarTudo();
  } catch (e) {
    falhou(e);
    if (botao.isConnected) ocupado(botao, false);
  }
}

function botaoEncerrar(itemId, statusItem, classe = 'btn btn--sucesso') {
  const rotulo = statusItem === 'em_devolucao' ? 'Marcar como devolvido e encerrar' : 'Encerrar item (resolvido por fora)';
  const b = el('button', { type: 'button', class: classe }, icone('check'), rotulo);
  b.addEventListener('click', () => acaoEncerrar(itemId, statusItem, b));
  return b;
}

function botao(rotulo, classe, nomeIcone, aoClicar) {
  const b = el('button', { type: 'button', class: classe }, nomeIcone ? icone(nomeIcone) : null, rotulo);
  b.addEventListener('click', () => aoClicar(b));
  return b;
}

// ----- blocos do detalhe -----
function linhaContato(rotulo, username, ehVoce) {
  const user = typeof username === 'string' && username ? username : null;
  return el('div', { class: 'contato' },
    el('span', { class: 'contato-rotulo' }, rotulo, ehVoce ? el('span', { class: 'voce' }, 'você') : null),
    el('span', { class: 'contato-valor' },
      icone('discord', 'ico contato-discord'),
      el('code', { class: 'contato-user' }, user ? `@${user}` : 'indisponível')),
    user ? botao('Copiar', 'btn btn--secundario btn--p btn-copiar', 'copiar', (b) => copiar(user, b)) : null);
}

function blocoContatos(r, item, souAutor, podeEncerrar) {
  const ativo = r.status === 'aceita';
  return el('section', { class: ['contatos', !ativo && 'contatos--encerrado'], 'aria-labelledby': 'contatosTitulo' },
    el('h3', { id: 'contatosTitulo', class: 'contatos-titulo' }, icone('discord'), ativo ? 'Combinem a devolução pelo Discord' : 'Contatos desta devolução'),
    el('p', { class: 'contatos-dica' }, ativo
      ? 'A reivindicação foi aceita. Chame a outra pessoa no Discord, marquem um ponto de encontro movimentado no campus e, depois da entrega, marquem como devolvido.'
      : 'Este caso já foi concluído.'),
    el('div', { class: 'contatos-lista' },
      linhaContato('Quem publicou', r.contato_autor, souAutor),
      linhaContato('Quem reivindicou', r.contato_reivindicante, !souAutor)),
    ativo && podeEncerrar && item.status === 'em_devolucao' ? el('div', { class: 'contatos-acoes' }, botaoEncerrar(item.id, item.status)) : null);
}

function formReivindicar(item) {
  const encontrei = item.tipo === 'encontrei';
  const ta = el('textarea', {
    id: 'reivMsg', name: 'mensagem', required: true, minlength: 10, maxlength: 500, rows: 4,
    'aria-describedby': 'reivDica',
    placeholder: encontrei
      ? 'Descreva algo que só o dono saberia: cor, marca, adesivo, o que tinha dentro…'
      : 'Conte onde e quando você encontrou e onde o objeto está guardado agora…',
  });
  const cont = el('span', { class: 'contador', 'aria-hidden': 'true' });
  const erro = el('p', { class: 'erro-form', role: 'alert', hidden: true });
  const enviar = el('button', { type: 'submit', class: 'btn btn--primario' }, icone('conversa'), encontrei ? 'Enviar: esse item é meu' : 'Enviar: eu encontrei');
  const form = el('form', { id: 'formReiv', class: 'form-reiv', 'aria-labelledby': 'reivTitulo', novalidate: true },
    el('h3', { id: 'reivTitulo', class: 'secao-titulo' }, encontrei ? 'É seu? Reivindique' : 'Encontrou? Avise quem perdeu'),
    el('div', { class: 'campo' },
      el('div', { class: 'campo-topo' }, el('label', { for: 'reivMsg' }, 'Mensagem para quem publicou'), cont),
      ta,
      el('p', { id: 'reivDica', class: 'dica' }, 'De 10 a 500 caracteres. Seu usuário do Discord fica registrado e só é mostrado para você e para quem publicou o item.')),
    erro,
    el('div', { class: 'form-acoes' }, enviar));
  ligarContador(ta, cont);
  ligarValidacaoNoCampo(form, NOMES_CAMPOS);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.hidden = true;
    validarAparado(ta);
    const invalido = validarNoCampo(form, NOMES_CAMPOS);
    if (invalido) { invalido.focus(); return; }
    ocupado(enviar, true);
    try {
      await api.reivindicar(item.id, ta.value.trim());
      avisar('Reivindicação enviada! Acompanhe na aba Reivindicações.', 'sucesso');
      await recarregarTudo();
    } catch (err) {
      falhou(err, erro);
      mostrarErrosCampos(form, err?.campos);
      if (err?.status === 409) await recarregarTudo();
    } finally {
      if (enviar.isConnected) ocupado(enviar, false);
    }
  });
  return form;
}

function cartaoReivRecebida(r, item) {
  const pessoa = pessoaReivindicante(r);
  const acoes = [];
  if (r.status === 'pendente') {
    if (item.status === 'aberto') acoes.push(botao('Aceitar', 'btn btn--primario btn--p', 'check', (b) => acaoAceitar(r, b)));
    acoes.push(botao('Recusar', 'btn btn--fantasma btn--p', 'x', (b) => acaoRecusar(r, b)));
  } else if (r.status === 'aceita') {
    acoes.push(botao('Desfazer aceite', 'btn btn--fantasma btn--p', 'x', (b) => acaoCancelar(r, b, true)));
  }
  return el('li', { class: ['reiv', `reiv--${r.status}`] },
    el('div', { class: 'reiv-topo' },
      avatar(pessoa, 'avatar avatar--m'),
      el('div', { class: 'reiv-quem' },
        el('strong', {}, nomeDe(pessoa)),
        el('span', { class: 'reiv-quando' }, tempo(r.criado_em))),
      seloReiv(r.status)),
    el('p', { class: 'reiv-msg' }, r.mensagem ?? ''),
    acoes.length ? el('div', { class: 'reiv-acoes' }, ...acoes) : null);
}

function renderDetalhe({ item, reivs, minha, souAutor, perm, temPendente }) {
  if (!item || typeof item !== 'object') {
    $('detConteudo').replaceChildren(cabecalhoDetalhe('Resposta inesperada do servidor', null));
    return;
  }
  const eu = estado.usuario;
  const cat = categoria(item.categoria);
  const aceitaOuConcluida = souAutor
    ? (reivs.find((r) => r.status === 'aceita') ?? reivs.find((r) => r.status === 'concluida'))
    : (minha && (minha.status === 'aceita' || minha.status === 'concluida') ? minha : null);

  const corpo = el('div', { class: 'dlg-corpo det' });

  // Metadados
  corpo.append(el('ul', { class: 'meta meta--det' },
    el('li', {}, el('span', { class: 'meta-rotulo' }, 'Categoria'), el('span', {}, iconeCategoria(item.categoria), cat.rotulo)),
    el('li', {}, el('span', { class: 'meta-rotulo' }, 'Local'), el('span', {}, icone('pin'), item.local ?? '')),
    el('li', {}, el('span', { class: 'meta-rotulo' }, item.tipo === 'perdi' ? 'Perdido em' : 'Encontrado em'),
      el('span', {}, icone('calendario'), el('time', { datetime: item.data_ocorrencia ?? '' }, formatarDia(item.data_ocorrencia)))),
    el('li', {}, el('span', { class: 'meta-rotulo' }, 'Publicado'), el('span', {}, icone('relogio'), tempo(item.criado_em) ?? '')),
    item.encerrado_em ? el('li', {}, el('span', { class: 'meta-rotulo' }, 'Encerrado em'), el('span', {}, dataHoraCompleta(item.encerrado_em))) : null));

  corpo.append(el('div', { class: 'det-autor' },
    autorMini(item.autor, souAutor ? 'você' : null),
    el('span', { class: 'det-autor-papel' }, item.tipo === 'perdi' ? 'perdeu este item' : 'encontrou este item')));

  corpo.append(el('section', { class: 'det-secao', 'aria-labelledby': 'detDescTitulo' },
    el('h3', { id: 'detDescTitulo', class: 'secao-titulo' }, 'Descrição'),
    el('p', { class: 'det-descricao' }, item.descricao ?? '')));

  // Contatos em destaque quando há reivindicação aceita (ou concluída) envolvendo o usuário.
  if (eu && aceitaOuConcluida) corpo.append(blocoContatos(aceitaOuConcluida, item, souAutor, perm.encerrar));

  // Lado de quem NÃO é autor
  if (eu && !souAutor) {
    if (minha && ATIVA(minha)) {
      const acoes = [botao(minha.status === 'aceita' ? 'Desistir da devolução' : 'Cancelar minha reivindicação', 'btn btn--fantasma btn--p', 'x', (b) => acaoCancelar(minha, b, false))];
      corpo.append(el('section', { class: 'det-secao minha-reiv', 'aria-labelledby': 'minhaTitulo' },
        el('div', { class: 'secao-cabecalho' }, el('h3', { id: 'minhaTitulo', class: 'secao-titulo' }, 'Sua reivindicação'), seloReiv(minha.status)),
        el('p', { class: 'reiv-msg' }, minha.mensagem ?? ''),
        minha.status === 'pendente' ? el('p', { class: 'dica' }, 'Aguardando resposta de quem publicou. Você será avisado aqui e na aba Reivindicações.') : null,
        el('div', { class: 'reiv-acoes' }, ...acoes)));
    } else {
      if (minha) {
        corpo.append(el('p', { class: 'nota' }, 'Sua última reivindicação neste item: ', seloReiv(minha.status)));
      }
      if (perm.reivindicar) corpo.append(formReivindicar(item));
      else if (item.status === 'em_devolucao' && !aceitaOuConcluida) corpo.append(el('p', { class: 'nota' }, 'Este item já está em devolução com outra pessoa e não aceita novas reivindicações.'));
    }
  } else if (!eu && item.status === 'aberto') {
    corpo.append(el('div', { class: 'cta-login' },
      el('p', {}, item.tipo === 'encontrei' ? 'Esse item é seu?' : 'Você encontrou esse item?', ' Entre com o Discord para reivindicar.'),
      el('a', { class: 'btn btn--discord', href: LOGIN_URL }, icone('discord'), 'Entrar com Discord')));
  }

  // Lado do autor
  if (souAutor) {
    const pend = reivs.filter((r) => r.status === 'pendente').length;
    const ordenadas = [...reivs].sort((a, b) => Number(ATIVA(b)) - Number(ATIVA(a)));
    corpo.append(el('section', { class: 'det-secao', 'aria-labelledby': 'recebidasTitulo' },
      el('div', { class: 'secao-cabecalho' },
        el('h3', { id: 'recebidasTitulo', class: 'secao-titulo' }, 'Reivindicações recebidas'),
        el('span', { class: 'secao-qtd' }, reivs.length ? `${reivs.length} no total${pend ? ` · ${plural(pend, 'pendente', 'pendentes')}` : ''}` : '')),
      reivs.length
        ? el('ul', { class: 'reivs' }, ...ordenadas.map((r) => cartaoReivRecebida(r, item)))
        : el('p', { class: 'nota' }, item.status === 'aberto' ? 'Ninguém reivindicou ainda. Você será avisado na aba Reivindicações.' : 'Nenhuma reivindicação.')));

    // Botões conforme `permissoes` do servidor (o botão de devolução já aparece no bloco de contatos).
    const encerrarNoContato = item.status === 'em_devolucao' && aceitaOuConcluida?.status === 'aceita';
    const acoes = [];
    if (perm.encerrar && !encerrarNoContato) {
      acoes.push(botaoEncerrar(item.id, item.status, item.status === 'aberto' ? 'btn btn--secundario' : 'btn btn--sucesso'));
    }
    if (perm.apagar) acoes.push(botao('Apagar item', 'btn btn--perigo-texto', 'lixeira', (b) => acaoApagar(item, b)));
    const avisoPendente = item.status === 'aberto' && temPendente && !perm.encerrar
      ? el('p', { class: 'dica' }, 'Para encerrar o item, responda antes as reivindicações pendentes (aceite ou recuse).')
      : null;
    if (acoes.length || avisoPendente) {
      corpo.append(el('section', { class: 'det-secao det-gerenciar', 'aria-label': 'Gerenciar item' },
        el('h3', { class: 'secao-titulo' }, 'Gerenciar'),
        acoes.length ? el('div', { class: 'reiv-acoes' }, ...acoes) : null,
        avisoPendente));
    }
  }

  $('detConteudo').replaceChildren(cabecalhoDetalhe(item.titulo ?? `Item #${item.id}`, item), corpo);
}

// ======================================================================
// Painel de reivindicações (feitas e recebidas)
// ======================================================================
function atualizarBadge() {
  const b = $('badgeReivs');
  const n = estado.reivs ? estado.reivs.recebidas.filter((r) => r.status === 'pendente').length : 0;
  b.textContent = String(n);
  b.hidden = n === 0;
  b.title = n ? `${plural(n, 'reivindicação pendente', 'reivindicações pendentes')} para você responder` : '';
}

async function carregarReivs(renderizar) {
  if (!estado.usuario) return;
  if (renderizar) {
    for (const id of ['listaRecebidas', 'listaFeitas']) {
      $(id).replaceChildren(...Array.from({ length: 2 }, () => el('div', { class: 'reiv-cartao reiv-cartao--esqueleto', 'aria-hidden': 'true' },
        el('span', { class: 'esq esq--linha esq--media' }), el('span', { class: 'esq esq--linha' }), el('span', { class: 'esq esq--linha esq--curta' }))));
    }
  }
  try {
    const r = await api.minhasReivindicacoes();
    estado.reivs = {
      feitas: Array.isArray(r?.feitas) ? r.feitas : [],
      recebidas: Array.isArray(r?.recebidas) ? r.recebidas : [],
    };
    atualizarBadge();
    if (renderizar || estado.ver === 'reivindicacoes') renderReivs();
  } catch (e) {
    if (e?.status === 401) { sessaoExpirou(); return; }
    if (renderizar) {
      const erro = blocoEstado({
        iconeNome: 'recarregar', titulo: 'Não conseguimos carregar suas reivindicações', texto: e?.message,
        acoes: [el('button', { type: 'button', class: 'btn btn--primario', onclick: () => carregarReivs(true) }, icone('recarregar'), 'Tentar de novo')],
      });
      $('listaRecebidas').replaceChildren(erro);
      $('listaFeitas').replaceChildren();
    }
  }
}

const PESO_STATUS = { pendente: 0, aceita: 1, concluida: 2, recusada: 3, cancelada: 4 };
function ordenarReivs(lista) {
  return [...lista].sort((a, b) => (PESO_STATUS[a.status] ?? 9) - (PESO_STATUS[b.status] ?? 9)
    || String(b.criado_em ?? '').localeCompare(String(a.criado_em ?? '')));
}

function miniContatos(r, lado) {
  return el('div', { class: 'contatos contatos--mini' + (r.status === 'aceita' ? '' : ' contatos--encerrado') },
    el('div', { class: 'contatos-lista' },
      linhaContato('Quem publicou', r.contato_autor, lado === 'recebida'),
      linhaContato('Quem reivindicou', r.contato_reivindicante, lado === 'feita')));
}

function cartaoReivPainel(r, lado) {
  const item = itemDaReiv(r);
  const recebida = lado === 'recebida';
  const pessoa = recebida ? pessoaReivindicante(r) : item.autor;
  const acoes = [];
  if (recebida) {
    if (r.status === 'pendente') {
      if (!item.status || item.status === 'aberto') acoes.push(botao('Aceitar', 'btn btn--primario btn--p', 'check', (b) => acaoAceitar(r, b)));
      acoes.push(botao('Recusar', 'btn btn--fantasma btn--p', 'x', (b) => acaoRecusar(r, b)));
    } else if (r.status === 'aceita') {
      acoes.push(botaoEncerrar(item.id, 'em_devolucao', 'btn btn--sucesso btn--p'));
      acoes.push(botao('Desfazer aceite', 'btn btn--fantasma btn--p', 'x', (b) => acaoCancelar(r, b, true)));
    }
  } else if (r.status === 'pendente') {
    acoes.push(botao('Cancelar', 'btn btn--fantasma btn--p', 'x', (b) => acaoCancelar(r, b, false)));
  } else if (r.status === 'aceita') {
    acoes.push(botaoEncerrar(item.id, 'em_devolucao', 'btn btn--sucesso btn--p'));
    acoes.push(botao('Desistir', 'btn btn--fantasma btn--p', 'x', (b) => acaoCancelar(r, b, false)));
  }
  const mostraContatos = (r.status === 'aceita' || r.status === 'concluida') && (r.contato_autor || r.contato_reivindicante);

  return el('article', { class: ['reiv-cartao', `reiv-cartao--${r.status}`] },
    el('div', { class: 'reiv-cartao-topo' },
      tileCategoria(item.categoria, 'cat-tile--p'),
      el('div', { class: 'reiv-cartao-item' },
        item.tipo ? seloTipo(item.tipo) : null,
        linkItem(item.id, item.titulo ?? `Item #${item.id ?? '?'}`, 'reiv-cartao-link')),
      seloReiv(r.status)),
    el('p', { class: 'reiv-pessoa' },
      pessoa ? avatar(pessoa, 'avatar avatar--p') : null,
      el('span', {}, recebida ? `${nomeDe(pessoa)} reivindicou` : pessoa ? `Publicado por ${nomeDe(pessoa)}` : 'Você reivindicou'),
      r.criado_em ? el('span', { class: 'reiv-quando' }, ' · ', tempo(r.criado_em)) : null),
    el('p', { class: 'reiv-msg' }, r.mensagem ?? ''),
    mostraContatos ? miniContatos(r, lado) : null,
    acoes.length ? el('div', { class: 'reiv-acoes' }, ...acoes) : null);
}

function renderReivs() {
  const { feitas, recebidas } = estado.reivs ?? { feitas: [], recebidas: [] };
  const pend = recebidas.filter((r) => r.status === 'pendente').length;
  $('tRecebidas').textContent = pend ? `Recebidas · ${pend} aguardando você` : 'Recebidas';
  $('listaRecebidas').replaceChildren(...(recebidas.length
    ? ordenarReivs(recebidas).map((r) => cartaoReivPainel(r, 'recebida'))
    : [blocoEstado({ iconeNome: 'caixa', titulo: 'Nenhuma reivindicação recebida', texto: 'Quando alguém reivindicar um item seu, ela aparece aqui para você aceitar ou recusar.' })]));
  $('listaFeitas').replaceChildren(...(feitas.length
    ? ordenarReivs(feitas).map((r) => cartaoReivPainel(r, 'feita'))
    : [blocoEstado({
      iconeNome: 'busca', titulo: 'Você ainda não reivindicou nada',
      texto: 'Achou seu objeto na vitrine? Abra o item e clique em reivindicar.',
      acoes: [el('button', { type: 'button', class: 'btn btn--secundario', onclick: () => trocarVisao('vitrine', { focar: true }) }, 'Ver a vitrine')],
    })]));
}

// ======================================================================
// Diálogos, tema e inicialização
// ======================================================================
function ligarDialogos() {
  for (const dlg of document.querySelectorAll('dialog')) {
    // Clique no fundo (fora da caixa) fecha.
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancelar'); });
    for (const b of dlg.querySelectorAll('[data-fechar]')) b.addEventListener('click', () => dlg.close('cancelar'));
  }
  $('dlgDetalhe').addEventListener('close', () => {
    estado.detalheId = null;
    escreverUrl();
  });
}

function ligarTema() {
  $('btnTema').addEventListener('click', () => {
    const raiz = document.documentElement;
    const atual = raiz.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const novo = atual === 'dark' ? 'light' : 'dark';
    raiz.setAttribute('data-theme', novo);
    try { localStorage.setItem('tema', novo); } catch { /* sem armazenamento: vale só nesta visita */ }
  });
}

async function iniciar() {
  const { login, erroLogin, item } = lerUrl();
  montarChips();
  preencherCamposFiltro();
  configurarDatasNovo();
  ligarFiltros();
  ligarAbas();
  ligarNovo();
  ligarDialogos();
  ligarTema();
  $('btnSair').addEventListener('click', sair);
  $('btnMais').addEventListener('click', () => carregarItens(true));

  // Limpa ?login / ?erro_login da URL, preservando filtros.
  escreverUrl();

  await carregarUsuario();

  if (login === 'ok') {
    avisar(estado.usuario ? `Olá, ${nomeDe(estado.usuario)}! Login feito com sucesso.` : 'Login concluído.', 'sucesso');
  }
  if (erroLogin) avisar(mensagemErroLogin(erroLogin), 'erro', 9000);

  trocarVisao(estado.ver);
  if (estado.usuario && estado.ver !== 'reivindicacoes') carregarReivs(false);
  if (item) abrirDetalhe(item);
}

iniciar();
