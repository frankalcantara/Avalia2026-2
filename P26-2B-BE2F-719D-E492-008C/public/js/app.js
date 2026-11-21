'use strict';

const ATRIBUTOS = [
  ['forca', 'Força'],
  ['destreza', 'Destreza'],
  ['constituicao', 'Constituição'],
  ['inteligencia', 'Inteligência'],
  ['sabedoria', 'Sabedoria'],
  ['carisma', 'Carisma'],
];
const DADOS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const ERROS_AUTH = {
  missing_code: 'Login cancelado ou incompleto.',
  invalid_state: 'Sessão de login inválida. Tente entrar de novo.',
  token_exchange_failed: 'O Discord recusou a autorização.',
  fetch_user_failed: 'Não foi possível ler seu perfil do Discord.',
  exception: 'Erro ao concluir o login. Tente novamente.',
};

const estado = {
  usuario: null,
  fichas: [],
  editandoId: null,
  dadoAtributo: 'd20',
  timer: null,
};

/* ---------- utilidades de DOM ---------- */

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const f of filhos) if (f != null) e.append(f);
  return e;
}

const rotuloAtributo = (chave) => (ATRIBUTOS.find((a) => a[0] === chave) || [chave, chave])[1];
const modificador = (v) => {
  const n = Math.floor((Number(v) - 10) / 2);
  return Number.isFinite(n) ? n : 0;
};
const fmtMod = (n) => (n >= 0 ? '+' + n : String(n));

function fmtData(s) {
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString('pt-BR');
}

let timerAviso;
function avisar(msg, tipo = 'erro') {
  const a = document.getElementById('aviso');
  a.textContent = msg;
  a.className = 'aviso ' + tipo;
  a.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { a.hidden = true; }, 5000);
}

/* ---------- acesso à API ---------- */

async function api(url, opcoes = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opcoes });
  if (r.status === 401) {
    estado.usuario = null;
    pararLog();
    renderizar();
    throw new Error('Sessão expirada. Entre novamente.');
  }
  const corpo = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error((corpo && corpo.erro) || 'Erro ' + r.status);
  return corpo;
}

/* ---------- telas ---------- */

function renderUsuario() {
  const caixa = document.getElementById('usuario');
  caixa.replaceChildren();
  if (!estado.usuario) return;
  caixa.append(
    el('img', { class: 'avatar', src: estado.usuario.avatar, alt: '', width: '32', height: '32' }),
    el('strong', { text: estado.usuario.nome }),
    el('button', {
      type: 'button',
      class: 'secundario',
      text: 'Sair',
      onclick: () => {
        fetch('/api/auth/logout', { method: 'POST' }).finally(() => location.reload());
      },
    })
  );
}

function telaLogin() {
  return el('section', { class: 'cartao boas-vindas' },
    el('h2', { text: 'Bem-vindo à mesa' }),
    el('p', { text: 'Entre com sua conta do Discord para criar fichas de personagem e rolar dados. Todas as rolagens são sorteadas no servidor e registradas no log da mesa.' }),
    el('a', { class: 'botao', href: '/api/auth/discord', text: 'Entrar com Discord' })
  );
}

function painelDados() {
  const botoes = el('div', { class: 'dados' });
  for (const d of DADOS) {
    botoes.append(el('button', { type: 'button', text: d, onclick: () => rolar({ dado: d }) }));
  }
  const seletor = el('select', {
    id: 'dadoAtributo',
    onchange: (ev) => { estado.dadoAtributo = ev.target.value; },
  });
  for (const d of DADOS) {
    const op = el('option', { value: d, text: d });
    if (d === estado.dadoAtributo) op.selected = true;
    seletor.append(op);
  }
  return el('section', { class: 'cartao' },
    el('h2', { text: 'Dados' }),
    botoes,
    el('div', { class: 'opcao-dado' },
      el('label', { for: 'dadoAtributo', text: 'Dado dos testes de atributo:' }),
      seletor
    ),
    el('div', { id: 'resultado', class: 'resultado', 'aria-live': 'polite' },
      el('div', { class: 'vazio', text: 'Role um dado para ver o resultado.' })
    )
  );
}

function painelFicha() {
  return el('section', { class: 'cartao', id: 'painelFicha' });
}

function renderFormulario() {
  const caixa = document.getElementById('painelFicha');
  if (!caixa) return;
  caixa.replaceChildren();
  const f = estado.fichas.find((x) => x.id === estado.editandoId) || null;
  const v = (campo, padrao) => (f ? f[campo] : padrao);

  const form = el('form', { class: 'form' });

  const nome = el('input', { id: 'f_nome', type: 'text', maxlength: '60', required: '', value: String(v('nome', '')) });
  const classe = el('input', { id: 'f_classe', type: 'text', maxlength: '40', value: String(v('classe', '') || '') });
  const nivel = el('input', { id: 'f_nivel', type: 'number', min: '1', max: '20', required: '', value: String(v('nivel', 1)) });
  form.append(el('div', { class: 'linha' },
    el('label', {}, 'Nome', nome),
    el('label', {}, 'Classe', classe),
    el('label', {}, 'Nível', nivel)
  ));

  const grade = el('div', { class: 'atributos' });
  for (const [chave, rotulo] of ATRIBUTOS) {
    const entrada = el('input', { id: 'f_' + chave, type: 'number', min: '1', max: '30', required: '', value: String(v(chave, 10)) });
    const mod = el('span', { class: 'mod', text: 'Modificador: ' + fmtMod(modificador(entrada.value)) });
    entrada.addEventListener('input', () => {
      mod.textContent = 'Modificador: ' + fmtMod(modificador(entrada.value));
    });
    grade.append(el('label', { class: 'attr' }, rotulo, entrada, mod));
  }
  form.append(grade);

  const acoes = el('div', { class: 'acoes' },
    el('button', { type: 'submit', text: f ? 'Atualizar ficha' : 'Salvar ficha' })
  );
  if (f) {
    acoes.append(el('button', {
      type: 'button',
      class: 'secundario',
      text: 'Cancelar edição',
      onclick: () => { estado.editandoId = null; renderFormulario(); },
    }));
  }
  form.append(acoes);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const dados = {
      nome: nome.value.trim(),
      classe: classe.value.trim(),
      nivel: Number(nivel.value),
    };
    for (const [chave] of ATRIBUTOS) dados[chave] = Number(document.getElementById('f_' + chave).value);
    try {
      if (estado.editandoId) {
        await api('/api/fichas', { method: 'PUT', body: JSON.stringify({ id: estado.editandoId, ...dados }) });
      } else {
        await api('/api/fichas', { method: 'POST', body: JSON.stringify(dados) });
      }
      estado.editandoId = null;
      await carregarFichas();
      renderFormulario();
      avisar('Ficha salva.', 'ok');
    } catch (e) {
      avisar(e.message);
    }
  });

  caixa.append(el('h2', { text: f ? 'Editar ficha' : 'Nova ficha' }), form);
}

function renderFichas() {
  const lista = document.getElementById('listaFichas');
  if (!lista) return;
  lista.replaceChildren();
  if (estado.fichas.length === 0) {
    lista.append(el('p', { class: 'vazio', text: 'Nenhuma ficha ainda. Crie a primeira acima.' }));
    return;
  }
  for (const f of estado.fichas) {
    const botoes = el('div', { class: 'botoes-attr' });
    for (const [chave, rotulo] of ATRIBUTOS) {
      botoes.append(el('button', {
        type: 'button',
        title: 'Rolar ' + rotulo,
        onclick: () => rolar({ dado: estado.dadoAtributo, ficha_id: f.id, atributo: chave }),
      },
        el('span', { text: rotulo }),
        el('strong', { text: f[chave] + ' (' + fmtMod(modificador(f[chave])) + ')' })
      ));
    }
    const sub = [f.classe, 'nível ' + f.nivel].filter(Boolean).join(' · ');
    lista.append(el('article', { class: 'ficha' },
      el('h3', { text: f.nome }),
      el('p', { class: 'sub', text: sub }),
      botoes,
      el('div', { class: 'acoes' },
        el('button', {
          type: 'button',
          class: 'secundario',
          text: 'Editar',
          onclick: () => {
            estado.editandoId = f.id;
            renderFormulario();
            document.getElementById('painelFicha').scrollIntoView({ behavior: 'smooth' });
          },
        }),
        el('button', {
          type: 'button',
          class: 'perigo',
          text: 'Excluir',
          onclick: () => excluirFicha(f),
        })
      )
    ));
  }
}

function painelLog() {
  return el('section', { class: 'cartao' },
    el('h2', { text: 'Log da mesa' }),
    el('ul', { id: 'logLista', class: 'log', 'aria-live': 'polite' })
  );
}

function renderizar() {
  renderUsuario();
  const app = document.getElementById('app');
  app.replaceChildren();
  if (!estado.usuario) {
    app.append(telaLogin());
    return;
  }
  app.append(el('div', { class: 'grade' },
    el('div', { class: 'coluna' },
      painelDados(),
      painelFicha(),
      el('section', { class: 'cartao' },
        el('h2', { text: 'Minhas fichas' }),
        el('div', { id: 'listaFichas', class: 'fichas' })
      )
    ),
    el('div', { class: 'coluna' }, painelLog())
  ));
  renderFormulario();
  renderFichas();
  atualizarLog();
}

/* ---------- ações ---------- */

async function carregarFichas() {
  estado.fichas = await api('/api/fichas');
  renderFichas();
}

async function excluirFicha(f) {
  if (!confirm('Excluir a ficha "' + f.nome + '"?')) return;
  try {
    await api('/api/fichas?id=' + encodeURIComponent(f.id), { method: 'DELETE' });
    if (estado.editandoId === f.id) estado.editandoId = null;
    await carregarFichas();
    renderFormulario();
    avisar('Ficha excluída.', 'ok');
  } catch (e) {
    avisar(e.message);
  }
}

function mostrarResultado(r, pedido) {
  const caixa = document.getElementById('resultado');
  if (!caixa) return;
  let detalhe = r.dado + ': ' + r.resultado;
  let contexto = 'Rolagem livre';
  if (pedido.ficha_id != null) {
    const ficha = estado.fichas.find((x) => x.id === pedido.ficha_id);
    detalhe += ' ' + fmtMod(r.modificador);
    contexto = rotuloAtributo(pedido.atributo) + (ficha ? ' de ' + ficha.nome : '');
  }
  caixa.replaceChildren(
    el('div', { class: 'total', text: String(r.total) }),
    el('div', { class: 'detalhe', text: detalhe }),
    el('div', { class: 'detalhe', text: contexto })
  );
}

async function rolar(pedido) {
  try {
    const r = await api('/api/rolagem', { method: 'POST', body: JSON.stringify(pedido) });
    mostrarResultado(r, pedido);
    await atualizarLog();
  } catch (e) {
    avisar(e.message);
  }
}

async function atualizarLog() {
  const ul = document.getElementById('logLista');
  if (!ul || !estado.usuario) return;
  try {
    const linhas = await api('/api/log');
    ul.replaceChildren();
    if (linhas.length === 0) {
      ul.append(el('li', { class: 'vazio', text: 'Nenhuma rolagem ainda.' }));
      return;
    }
    for (const l of linhas) {
      let texto = ' rolou ' + l.dado;
      if (l.atributo) {
        texto += ' de ' + rotuloAtributo(l.atributo);
        if (l.personagem) texto += ' (' + l.personagem + ')';
        texto += ': ' + l.resultado + ' ' + fmtMod(l.modificador) + ' = ' + l.total;
      } else {
        texto += ': ' + l.resultado;
      }
      ul.append(el('li', {},
        el('span', { class: 'data', text: fmtData(l.criado_em) }),
        el('strong', { text: l.username }),
        document.createTextNode(texto)
      ));
    }
  } catch {
    /* mantém o log anterior se a atualização falhar */
  }
}

function iniciarLog() {
  pararLog();
  estado.timer = setInterval(() => {
    if (document.visibilityState === 'visible') atualizarLog();
  }, 5000);
}

function pararLog() {
  if (estado.timer) {
    clearInterval(estado.timer);
    estado.timer = null;
  }
}

/* ---------- início ---------- */

function tratarRetornoLogin() {
  const params = new URLSearchParams(location.search);
  const erro = params.get('auth_error');
  if (erro) avisar(ERROS_AUTH[erro] || 'Erro de login.');
  if (erro || params.has('login')) history.replaceState(null, '', location.pathname);
}

async function iniciar() {
  tratarRetornoLogin();
  try {
    const r = await fetch('/api/me');
    if (r.ok) estado.usuario = await r.json();
  } catch {
    avisar('Não foi possível falar com o servidor.');
  }
  renderizar();
  if (estado.usuario) {
    try { await carregarFichas(); } catch { /* o aviso já foi exibido */ }
    iniciarLog();
  }
}

iniciar();