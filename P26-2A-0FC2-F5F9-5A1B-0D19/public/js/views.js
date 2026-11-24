// Telas da aplicação: login, lista, nova enquete e detalhe/resultado.
// Cada view recebe o contexto (ctx) criado em app.js:
//   ctx.app          elemento <main id="app">
//   ctx.ativa()      false se o usuário já trocou de tela (evita render atrasado)
//   ctx.timer(fn)    registra função chamada a cada segundo (limpa ao trocar de tela)
//   ctx.semSessao()  volta para a tela de login (resposta 401)
import { h, mount, formatarData, tempoRestante, paraDatetimeLocal } from './dom.js';
import { api } from './api.js';

/** Se o avatar do Discord falhar, usa o avatar padrão do próprio Discord. */
export function avatarPadrao(ev) {
  const img = ev.currentTarget;
  img.onerror = null;
  img.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
}

const MIN_OPCOES = 2;
const MAX_OPCOES = 10;

// Mensagens amigáveis para ?erro=<codigo> vindo do callback do OAuth.
const ERROS_LOGIN = {
  state_invalido: 'A verificação de segurança do login expirou. Tente entrar novamente.',
  acesso_negado: 'Você cancelou a autorização no Discord.',
  oauth_not_configured: 'O login com Discord ainda não foi configurado no servidor.',
};

/* ---------- Componentes reutilizáveis ---------- */

const carregando = (texto = 'Carregando...') =>
  h('div', { class: 'estado', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), texto);

const aviso = (tipo, texto) => h('div', { class: `aviso aviso-${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' }, texto);

const criador = (c) =>
  h('span', { class: 'criador' },
    c?.avatar_url ? h('img', { src: c.avatar_url, alt: '', width: 24, height: 24, loading: 'lazy', onError: avatarPadrao }) : null,
    c?.username || 'Desconhecido');

/** Span com contagem regressiva; atualizado a cada segundo usando o offset do servidor. */
function contagem(ctx, closesAt, offset, aoEncerrar) {
  const el = h('span', { class: 'contagem' });
  const atualizar = () => {
    const restante = closesAt - (Date.now() + offset);
    if (restante <= 0) {
      el.textContent = 'encerrada';
      if (aoEncerrar) { const f = aoEncerrar; aoEncerrar = null; f(); }
      return;
    }
    el.textContent = `encerra em ${tempoRestante(restante)}`;
  };
  atualizar();
  ctx.timer(atualizar);
  return el;
}

/** Trata erros comuns; retorna true se já foi resolvido (ex.: 401). */
function tratarErro(ctx, err, alvo) {
  if (err.status === 401) { ctx.semSessao(); return true; }
  mount(alvo, aviso('erro', err.message));
  return false;
}

/* ---------- Login ---------- */

export function viewLogin(ctx, erro) {
  const recursos = [
    ['Login verificado', 'Entre com sua conta do Discord. Nada de cadastro nem senha.'],
    ['Um voto por pessoa', 'O servidor garante que cada conta vota uma única vez em cada enquete.'],
    ['Resultado transparente', 'Veja as barras de resultado depois de votar ou quando o prazo acabar.'],
  ];
  mount(ctx.app,
    h('section', { class: 'boas-vindas' },
      erro ? aviso('erro', ERROS_LOGIN[erro] || 'Não foi possível concluir o login. Tente novamente.') : null,
      h('p', { class: 'sobretitulo' }, 'Enquetes e votação verificada'),
      h('h1', {}, 'Decida em grupo, com um voto por pessoa.'),
      h('p', { class: 'lead' },
        'Crie enquetes com prazo, compartilhe com sua turma ou comunidade e acompanhe o resultado em tempo real, sem votos duplicados.'),
      h('a', { class: 'btn btn-discord', href: '/api/auth/discord' }, iconeDiscord(), 'Entrar com Discord'),
      h('ul', { class: 'recursos' },
        recursos.map(([t, d]) => h('li', { class: 'card' }, h('strong', {}, t), h('span', {}, d))))
    )
  );
}

function iconeDiscord() {
  // SVG criado via DOM (namespace) para não usar innerHTML.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('fill', 'currentColor');
  p.setAttribute('d', 'M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.8-3.6-13.7ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z');
  svg.append(p);
  return svg;
}

/* ---------- Lista ---------- */

export async function viewLista(ctx) {
  const corpo = h('div', {}, carregando('Carregando enquetes...'));
  mount(ctx.app,
    h('div', { class: 'topo' },
      h('h1', {}, 'Enquetes'),
      h('a', { class: 'btn btn-primario', href: '#/nova' }, '+ Nova enquete')),
    corpo);

  let dados;
  try { dados = await api.listarEnquetes(); }
  catch (err) { if (ctx.ativa()) tratarErro(ctx, err, corpo); return; }
  if (!ctx.ativa()) return;

  const offset = dados.server_now - Date.now();
  if (!dados.polls.length) {
    mount(corpo, h('div', { class: 'vazio card' },
      h('p', {}, 'Nenhuma enquete por aqui ainda.'),
      h('a', { class: 'btn btn-primario', href: '#/nova' }, 'Criar a primeira enquete')));
    return;
  }
  mount(corpo, h('ul', { class: 'grade' }, dados.polls.map((p) => cardEnquete(ctx, p, offset))));
}

function cardEnquete(ctx, p, offset) {
  const status = h('span', { class: `selo ${p.is_open ? 'selo-aberta' : 'selo-encerrada'}` },
    p.is_open ? 'Aberta' : 'Encerrada');
  const prazo = p.is_open
    ? contagem(ctx, p.closes_at, offset, () => {
        status.className = 'selo selo-encerrada';
        status.textContent = 'Encerrada';
      })
    : h('span', {}, `encerrou em ${formatarData(p.closes_at)}`);
  const votos = `${p.total_votes} ${p.total_votes === 1 ? 'voto' : 'votos'}`;

  return h('li', {},
    h('a', { class: `card card-enquete${p.is_open ? '' : ' fechada'}`, href: `#/enquete/${p.id}` },
      h('div', { class: 'card-linha' }, status, p.has_voted ? h('span', { class: 'selo selo-votei' }, '✓ Você votou') : null),
      h('h2', {}, p.title),
      p.description ? h('p', { class: 'descricao' }, p.description) : null,
      h('div', { class: 'meta' }, prazo, h('span', {}, votos), h('span', {}, `${p.option_count} opções`)),
      h('div', { class: 'card-rodape' }, criador(p.creator))));
}

/* ---------- Nova enquete ---------- */

export function viewNova(ctx) {
  const erroBox = h('div', { 'aria-live': 'polite' });
  const lista = h('ol', { class: 'opcoes-edit' });
  const btnAdd = h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => addOpcao('') }, '+ Adicionar opção');
  const minPrazo = () => paraDatetimeLocal(new Date(Date.now() + 5 * 60 * 1000));
  const prazo = h('input', { type: 'datetime-local', id: 'prazo', name: 'prazo', required: true, min: minPrazo(),
    value: paraDatetimeLocal(new Date(Date.now() + 24 * 3600 * 1000)) });
  const titulo = h('input', { type: 'text', id: 'titulo', name: 'titulo', required: true, minlength: 3, maxlength: 120,
    placeholder: 'Ex.: Qual dia para a reunião?' });
  const descricao = h('textarea', { id: 'descricao', name: 'descricao', maxlength: 1000, rows: 3,
    placeholder: 'Contexto opcional para quem vai votar' });
  const btnCriar = h('button', { type: 'submit', class: 'btn btn-primario' }, 'Criar enquete');

  // Mantém o min do prazo sempre em "agora + 5 min".
  ctx.timer(() => { prazo.min = minPrazo(); });

  function atualizarBotoes() {
    const itens = lista.children;
    btnAdd.disabled = itens.length >= MAX_OPCOES;
    [...itens].forEach((li, i) => {
      li.querySelector('input').setAttribute('aria-label', `Opção ${i + 1}`);
      li.querySelector('button').disabled = itens.length <= MIN_OPCOES;
    });
  }

  function addOpcao(valor) {
    if (lista.children.length >= MAX_OPCOES) return;
    const input = h('input', { type: 'text', maxlength: 100, required: true, value: valor, placeholder: 'Texto da opção' });
    const li = h('li', {}, input,
      h('button', { type: 'button', class: 'btn-icone', title: 'Remover opção', 'aria-label': 'Remover opção',
        onclick: () => { li.remove(); atualizarBotoes(); } }, '×'));
    lista.append(li);
    atualizarBotoes();
    if (valor === '' && lista.children.length > MIN_OPCOES) input.focus();
  }
  addOpcao(''); addOpcao('');

  // Validação no cliente só para UX; a regra final é do servidor.
  function validar(dados) {
    if (dados.title.length < 3 || dados.title.length > 120) return 'O título deve ter entre 3 e 120 caracteres.';
    if (dados.description.length > 1000) return 'A descrição pode ter no máximo 1000 caracteres.';
    const ms = new Date(prazo.value).getTime();
    if (!prazo.value || Number.isNaN(ms)) return 'Informe um prazo válido.';
    if (ms < Date.now() + 5 * 60 * 1000) return 'O prazo deve ser pelo menos 5 minutos no futuro.';
    if (ms > Date.now() + 365 * 86400 * 1000) return 'O prazo pode ser de no máximo 365 dias.';
    if (dados.options.some((o) => !o)) return 'Preencha todas as opções ou remova as vazias.';
    const unicas = new Set(dados.options.map((o) => o.toLowerCase()));
    if (unicas.size !== dados.options.length) return 'Há opções repetidas.';
    return null;
  }

  async function enviar(ev) {
    ev.preventDefault();
    const dados = {
      title: titulo.value.trim(),
      description: descricao.value.trim(),
      closes_at: prazo.value ? new Date(prazo.value).toISOString() : '',
      options: [...lista.querySelectorAll('input')].map((i) => i.value.trim()),
    };
    const problema = validar(dados);
    if (problema) { mount(erroBox, aviso('erro', problema)); return; }

    btnCriar.disabled = true;
    btnCriar.textContent = 'Criando...';
    mount(erroBox);
    try {
      const r = await api.criarEnquete(dados);
      location.hash = `#/enquete/${r.poll.id}`;
    } catch (err) {
      if (err.status === 401) return ctx.semSessao();
      mount(erroBox, aviso('erro', err.message)); // mensagem final sempre do servidor
      btnCriar.disabled = false;
      btnCriar.textContent = 'Criar enquete';
    }
  }

  mount(ctx.app,
    h('a', { class: 'voltar', href: '#/' }, '← Voltar'),
    h('form', { class: 'card formulario', onsubmit: enviar, novalidate: true },
      h('h1', {}, 'Nova enquete'),
      h('label', { for: 'titulo' }, 'Título'), titulo,
      h('label', { for: 'descricao' }, 'Descrição ', h('span', { class: 'opcional' }, '(opcional)')), descricao,
      h('label', { for: 'prazo' }, 'Encerra em'), prazo,
      h('small', { class: 'dica' }, 'Mínimo de 5 minutos a partir de agora, máximo de 365 dias.'),
      h('fieldset', {},
        h('legend', {}, `Opções (${MIN_OPCOES} a ${MAX_OPCOES})`),
        lista, btnAdd),
      erroBox,
      h('div', { class: 'acoes' }, h('a', { class: 'btn btn-secundario', href: '#/' }, 'Cancelar'), btnCriar)));
  titulo.focus();
}

/* ---------- Detalhe / resultado ---------- */

export async function viewDetalhe(ctx, id, avisoInicial) {
  mount(ctx.app, h('a', { class: 'voltar', href: '#/' }, '← Voltar'), carregando('Carregando enquete...'));

  let dados;
  try { dados = await api.obterEnquete(id); }
  catch (err) {
    if (!ctx.ativa()) return;
    if (err.status === 401) return ctx.semSessao();
    mount(ctx.app, h('a', { class: 'voltar', href: '#/' }, '← Voltar'), aviso('erro', err.message));
    return;
  }
  if (!ctx.ativa()) return;

  const poll = dados.poll;
  const offset = dados.server_now - Date.now();
  const recarregar = (msg) => viewDetalhe(ctx, id, msg);
  const area = h('div', {});
  const avisos = h('div', { 'aria-live': 'polite' }, avisoInicial ? aviso('info', avisoInicial) : null);

  const prazo = poll.is_open
    ? contagem(ctx, poll.closes_at, offset, () => {
        // Prazo acabou com a tela aberta: recarrega para obter o resultado final.
        if (ctx.ativa()) recarregar('O prazo terminou. Este é o resultado final.');
      })
    : h('span', {}, `encerrou em ${formatarData(poll.closes_at)}`);

  mount(ctx.app,
    h('a', { class: 'voltar', href: '#/' }, '← Voltar'),
    h('article', { class: 'card detalhe' },
      h('div', { class: 'card-linha' },
        h('span', { class: `selo ${poll.is_open ? 'selo-aberta' : 'selo-encerrada'}` }, poll.is_open ? 'Aberta' : 'Encerrada'),
        prazo),
      h('h1', {}, poll.title),
      poll.description ? h('p', { class: 'descricao-longa' }, poll.description) : null,
      h('div', { class: 'meta' }, criador(poll.creator), h('span', {}, `prazo: ${formatarData(poll.closes_at)}`)),
      avisos,
      area));

  if (poll.results) {
    mount(area, resultados(poll.results, poll.my_option_id, poll.is_open));
  } else {
    mount(area, formularioVoto(ctx, poll, avisos, area, recarregar));
  }
}

function formularioVoto(ctx, poll, avisos, area, recarregar) {
  const btn = h('button', { type: 'submit', class: 'btn btn-primario', disabled: true }, 'Votar');
  const opcoes = poll.options.map((o) =>
    h('label', { class: 'opcao-radio' },
      h('input', { type: 'radio', name: 'opcao', value: String(o.id), onchange: () => { btn.disabled = false; } }),
      h('span', {}, o.label)));

  async function votar(ev) {
    ev.preventDefault();
    const marcado = ev.currentTarget.querySelector('input[name="opcao"]:checked');
    if (!marcado) return;
    btn.disabled = true; // evita duplo clique
    btn.textContent = 'Enviando...';
    mount(avisos);
    try {
      const r = await api.votar(poll.id, Number(marcado.value));
      if (!ctx.ativa()) return;
      mount(avisos, aviso('sucesso', 'Voto registrado! Veja o resultado parcial.'));
      mount(area, resultados(r.results, r.my_option_id ?? Number(marcado.value), true));
    } catch (err) {
      if (!ctx.ativa()) return;
      if (err.status === 401) return ctx.semSessao();
      if (err.status === 409) return recarregar('Você já votou nesta enquete. Veja o resultado abaixo.');
      if (err.status === 403) return recarregar('Esta enquete foi encerrada antes do seu voto.');
      mount(avisos, aviso('erro', err.message));
      btn.disabled = false;
      btn.textContent = 'Votar';
    }
  }

  return h('form', { class: 'voto', onsubmit: votar },
    h('fieldset', {}, h('legend', {}, 'Escolha uma opção'), opcoes),
    h('div', { class: 'acoes' }, btn));
}

/** Barras horizontais proporcionais ao percentual de cada opção. */
function resultados(res, minhaOpcao, parcial) {
  const maxVotos = Math.max(0, ...res.options.map((o) => o.votes));
  const barras = res.options.map((o) => {
    const minha = o.id === minhaOpcao;
    const lider = o.votes > 0 && o.votes === maxVotos;
    const fill = h('div', { class: 'bar' });
    // Começa em 0 e anima até o percentual no próximo quadro (transição CSS).
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${o.percent}%`; }));
    return h('li', { class: `resultado${minha ? ' minha' : ''}${lider ? ' lider' : ''}` },
      h('div', { class: 'resultado-topo' },
        h('span', { class: 'rotulo' }, o.label, minha ? h('span', { class: 'selo selo-votei' }, 'seu voto') : null),
        h('span', { class: 'numeros' },
          h('strong', {}, `${o.percent.toFixed(1).replace('.', ',')}%`),
          ` · ${o.votes} ${o.votes === 1 ? 'voto' : 'votos'}`)),
      h('div', { class: 'trilho', role: 'meter', 'aria-label': o.label, 'aria-valuemin': 0, 'aria-valuemax': 100,
        'aria-valuenow': o.percent, 'aria-valuetext': `${o.percent}% (${o.votes} votos)` }, fill));
  });
  return h('section', { class: 'resultados', 'aria-label': 'Resultados' },
    h('h2', {}, parcial ? 'Resultado parcial' : 'Resultado final'),
    h('ul', {}, barras),
    h('p', { class: 'total' }, `Total: ${res.total_votes} ${res.total_votes === 1 ? 'voto' : 'votos'}`));
}
