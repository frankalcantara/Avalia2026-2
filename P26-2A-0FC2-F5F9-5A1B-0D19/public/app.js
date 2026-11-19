// Ponto de entrada: verifica a sessão, controla o cabeçalho e roteia por hash.
import { api } from './js/api.js';
import { viewLogin, viewLista, viewNova, viewDetalhe } from './js/views.js';

const app = document.getElementById('app');
const areaUsuario = document.getElementById('usuario');
const avatar = document.getElementById('avatar');
const nome = document.getElementById('nome');
const btnSair = document.getElementById('sair');

let usuario = null;
let renderAtual = 0;   // incrementa a cada troca de tela
let timers = [];       // funções chamadas a cada segundo na tela atual

// Um único intervalo global alimenta as contagens regressivas.
setInterval(() => timers.forEach((fn) => fn()), 1000);

/** Cria o contexto de uma nova tela, invalidando o anterior. */
function novoContexto() {
  const id = ++renderAtual;
  timers = [];
  return {
    app,
    ativa: () => id === renderAtual,
    timer: (fn) => { if (id === renderAtual) timers.push(fn); },
    semSessao: () => mostrarLogin(),
  };
}

function mostrarLogin(erro) {
  usuario = null;
  areaUsuario.hidden = true;
  document.title = 'Entrar · Enquetes Verificadas';
  viewLogin(novoContexto(), erro);
}

function mostrarUsuario(u) {
  usuario = u;
  avatar.src = u.avatar_url;
  avatar.alt = '';
  avatar.onerror = () => { avatar.onerror = null; avatar.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; };
  nome.textContent = u.username;
  areaUsuario.hidden = false;
}

/** Decide a tela a partir do hash atual. */
function rotear() {
  if (!usuario) return;
  const hash = location.hash || '#/';
  const ctx = novoContexto();
  const detalhe = hash.match(/^#\/enquete\/(\d+)$/);
  window.scrollTo(0, 0);
  if (hash === '#/nova') {
    document.title = 'Nova enquete · Enquetes Verificadas';
    viewNova(ctx);
  } else if (detalhe) {
    document.title = 'Enquete · Enquetes Verificadas';
    viewDetalhe(ctx, detalhe[1]);
  } else {
    document.title = 'Enquetes Verificadas';
    if (hash !== '#/') history.replaceState(null, '', '#/');
    viewLista(ctx);
  }
}

btnSair.addEventListener('click', async () => {
  btnSair.disabled = true;
  try { await api.logout(); } catch { /* mesmo com erro, volta ao login */ }
  btnSair.disabled = false;
  history.replaceState(null, '', location.pathname);
  mostrarLogin();
});

window.addEventListener('hashchange', rotear);

async function iniciar() {
  // Erro vindo do callback do OAuth (?erro=...): mostra aviso e limpa a URL.
  const params = new URLSearchParams(location.search);
  const erro = params.get('erro');
  if (erro !== null) history.replaceState(null, '', location.pathname + location.hash);

  try {
    const r = await api.me();
    mostrarUsuario(r.user);
    rotear();
  } catch (err) {
    if (err.status === 401) mostrarLogin(erro);
    else {
      mostrarLogin(erro);
      // Falha diferente de 401 (rede/servidor): avisa no topo da tela de login.
      const box = document.createElement('div');
      box.className = 'aviso aviso-erro';
      box.setAttribute('role', 'alert');
      box.textContent = err.message;
      app.prepend(box);
    }
  }
}

iniciar();
