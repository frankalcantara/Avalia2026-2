// Helpers de interface. Regra de ouro: dado do servidor/usuário entra no DOM só como
// texto (append de string = nó de texto) ou atributo — nunca como HTML.

// `icone` = nome do <symbol> no sprite do index.html (sem o prefixo "i-"). Nada de emoji como ícone.
export const CATEGORIAS = {
  eletronicos: { rotulo: 'Eletrônicos', icone: 'cat-eletronicos' },
  documentos: { rotulo: 'Documentos', icone: 'cat-documentos' },
  garrafas: { rotulo: 'Garrafas', icone: 'cat-garrafas' },
  vestuario: { rotulo: 'Vestuário', icone: 'cat-vestuario' },
};
export const TIPOS = {
  perdi: { rotulo: 'Perdi', icone: 'busca' },
  encontrei: { rotulo: 'Encontrei', icone: 'encontrei' },
};
const ICONE_STATUS_ITEM = { aberto: 'aberto', em_devolucao: 'troca', encerrado: 'arquivo' };
const ICONE_STATUS_REIV = { pendente: 'relogio', aceita: 'check', recusada: 'x', cancelada: 'proibido', concluida: 'check-duplo' };
export const STATUS_ITEM = {
  aberto: 'Aberto',
  em_devolucao: 'Em devolução',
  encerrado: 'Encerrado',
};
export const STATUS_REIV = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Aceita só URLs relativas ou http(s) — bloqueia javascript:, data:, etc. */
export function urlSegura(valor) {
  try {
    const u = new URL(String(valor), location.href);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Cria um elemento. attrs: class (string|array), dataset, on<evento> (função),
 * booleanos (true = atributo vazio), demais viram setAttribute. Filhos: Node ou texto.
 */
export function el(tag, attrs = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') {
      no.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
    } else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v)) no.dataset[dk] = String(dv);
    } else if (k.startsWith('on')) {
      if (typeof v !== 'function') throw new TypeError(`Atributo de evento "${k}" precisa ser função.`);
      no.addEventListener(k.slice(2).toLowerCase(), v);
    } else if ((k === 'href' || k === 'src') && !urlSegura(v)) {
      continue;
    } else if (v === true) {
      no.setAttribute(k, '');
    } else {
      no.setAttribute(k, String(v));
    }
  }
  anexar(no, filhos);
  return no;
}

export function anexar(no, filhos) {
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    no.append(f instanceof Node ? f : String(f));
  }
  return no;
}

export function icone(nome, classe = 'ico') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', classe);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${nome}`);
  svg.append(use);
  return svg;
}

export function nomeDe(u) {
  return (u && (u.nome_exibicao || u.username)) || 'Usuário';
}

function hashCor(texto) {
  let h = 0;
  for (const ch of String(texto)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 6;
}

function iniciais(u, classe) {
  const nome = nomeDe(u).trim();
  const letra = (Array.from(nome)[0] ?? '?').toUpperCase();
  return el('span', { class: `${classe} avatar--iniciais avatar--c${hashCor(u?.user_id ?? nome)}`, 'aria-hidden': 'true' }, letra);
}

/** Avatar do Discord (só de cdn.discordapp.com) ou iniciais. Decorativo: o nome vem ao lado. */
export function avatar(u, classe = 'avatar') {
  const url = u?.avatar_url;
  if (typeof url === 'string' && url.startsWith('https://cdn.discordapp.com/')) {
    const img = el('img', {
      class: classe, src: url, alt: '', width: 40, height: 40,
      loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer',
    });
    img.addEventListener('error', () => img.replaceWith(iniciais(u, classe)), { once: true });
    return img;
  }
  return iniciais(u, classe);
}

// ---------- Datas ----------
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "YYYY-MM-DD" como data LOCAL (sem o deslocamento de fuso do Date.parse). */
export function dataLocal(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hojeISO() {
  return isoLocal(new Date());
}

export function umAnoAtrasISO() {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()));
}

/** Data de ocorrência: "Hoje", "Ontem" ou "12 de out. de 2026". */
export function formatarDia(iso) {
  const d = dataLocal(iso);
  if (!d) return String(iso ?? '');
  const hoje = dataLocal(hojeISO());
  const dias = Math.round((hoje - d) / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  return fmtDia.format(d);
}

/** Carimbo do servidor (ISO ou "YYYY-MM-DD HH:MM:SS" em UTC do SQLite). */
export function dataHora(s) {
  if (!s) return null;
  let t = String(s);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(t)) t = `${t.replace(' ', 'T')}Z`;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tempoRelativo(s) {
  const d = dataHora(s);
  if (!d) return '';
  const seg = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(seg);
  if (abs < 60) return 'agora mesmo';
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seg / 86400), 'day');
  return fmtDia.format(d);
}

export function dataHoraCompleta(s) {
  const d = dataHora(s);
  return d ? fmtDiaHora.format(d) : '';
}

/** <time> com texto relativo e data completa no title. */
export function tempo(s) {
  const d = dataHora(s);
  if (!d) return null;
  return el('time', { datetime: d.toISOString(), title: fmtDiaHora.format(d) }, tempoRelativo(s));
}

// ---------- Selos ----------
// Ícone + texto: a cor nunca é o único sinal (o texto do selo é sempre visível).
export function seloTipo(tipo) {
  const t = TIPOS[tipo];
  return el('span', { class: ['selo', `selo--${t ? tipo : 'neutro'}`] },
    t ? icone(t.icone, 'ico selo-ico') : null, t ? t.rotulo : String(tipo ?? ''));
}

export function seloStatus(status) {
  const ok = Boolean(STATUS_ITEM[status]);
  return el('span', { class: ['selo', 'selo--contorno', `selo--st-${ok ? status : 'neutro'}`] },
    icone(ok ? ICONE_STATUS_ITEM[status] : 'alerta', 'ico selo-ico'), STATUS_ITEM[status] ?? String(status ?? ''));
}

export function seloReiv(status) {
  const ok = Boolean(STATUS_REIV[status]);
  return el('span', { class: ['selo', 'selo--contorno', `selo--rv-${ok ? status : 'neutro'}`] },
    icone(ok ? ICONE_STATUS_REIV[status] : 'alerta', 'ico selo-ico'), STATUS_REIV[status] ?? String(status ?? ''));
}

export function categoria(cat) {
  return CATEGORIAS[cat] ?? { rotulo: String(cat ?? 'Outros'), icone: 'cat-outros' };
}

/** Ícone da categoria, já com a cor da categoria (decorativo: o rótulo aparece em texto ao lado). */
export function iconeCategoria(cat, classe = 'ico') {
  const chave = CATEGORIAS[cat] ? cat : 'outros';
  return icone(categoria(cat).icone, `${classe} cat-tinta--${chave}`);
}

export function tileCategoria(cat, extra = '') {
  const chave = CATEGORIAS[cat] ? cat : 'outros';
  return el('span', { class: ['cat-tile', `cat--${chave}`, extra], 'aria-hidden': 'true' }, iconeCategoria(cat));
}

// ---------- Avisos (toasts) ----------
export function avisar(mensagem, tipo = 'info', ms = 5000) {
  const caixa = document.getElementById('avisos');
  if (!caixa) return;
  const nomeIcone = tipo === 'erro' ? 'x' : tipo === 'sucesso' ? 'check' : 'conversa';
  const aviso = el('div', { class: ['aviso', `aviso--${tipo}`], role: tipo === 'erro' ? 'alert' : 'status' },
    el('span', { class: 'aviso-ico' }, icone(nomeIcone)),
    el('span', { class: 'aviso-texto' }, String(mensagem)),
    el('button', { type: 'button', class: 'aviso-fechar', 'aria-label': 'Fechar aviso', onclick: () => aviso.remove() }, icone('x')));
  caixa.append(aviso);
  while (caixa.children.length > 4) caixa.firstElementChild.remove();
  setTimeout(() => aviso.remove(), ms);
}

// ---------- Confirmação (dialog nativo) ----------
export function confirmar({ titulo, texto, botao = 'Confirmar', perigo = false }) {
  const dlg = document.getElementById('dlgConfirmar');
  document.getElementById('confTitulo').textContent = titulo;
  document.getElementById('confTexto').textContent = texto ?? '';
  const ok = document.getElementById('confOk');
  ok.textContent = botao;
  ok.classList.toggle('btn--perigo', perigo);
  ok.classList.toggle('btn--primario', !perigo);
  dlg.returnValue = '';
  return new Promise((resolver) => {
    dlg.addEventListener('close', () => resolver(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
    ok.focus();
  });
}

// ---------- Copiar ----------
export async function copiar(texto, botao) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(texto);
    ok = true;
  } catch {
    const ta = el('textarea', { class: 'sr-only', readonly: true, 'aria-hidden': 'true' });
    ta.value = texto;
    document.body.append(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  if (ok) {
    avisar(`Copiado: ${texto}`, 'sucesso', 2500);
    if (botao) {
      botao.classList.add('copiado');
      setTimeout(() => botao.classList.remove('copiado'), 1600);
    }
  } else {
    avisar('Não foi possível copiar. Selecione o texto e copie manualmente.', 'erro');
  }
}

// ---------- Formulários ----------
export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Bloqueia texto que só cumpre o mínimo por causa de espaços (o servidor faz trim). */
export function validarAparado(campo) {
  const min = campo.minLength > 0 ? campo.minLength : 0;
  const aparado = campo.value.trim().length;
  if (campo.value.length > 0 && aparado < min) {
    campo.setCustomValidity(`Escreva pelo menos ${min} caracteres (espaços nas pontas não contam).`);
  } else {
    campo.setCustomValidity('');
  }
}

export function ligarContador(campo, saida) {
  const atualizar = () => {
    const n = campo.value.length;
    const max = campo.maxLength > 0 ? campo.maxLength : 0;
    const min = campo.minLength > 0 ? campo.minLength : 0;
    saida.textContent = max ? `${n}/${max}` : String(n);
    saida.classList.toggle('contador--curto', n > 0 && campo.value.trim().length < min);
    saida.classList.toggle('contador--limite', max > 0 && n >= max * 0.9);
    validarAparado(campo);
  };
  campo.addEventListener('input', atualizar);
  atualizar();
  return atualizar;
}

// ---------- Erros junto ao campo ----------
// A mensagem fica logo abaixo do campo (dentro do .campo), ligada ao controle por aria-describedby,
// e o controle recebe aria-invalid. Nada de balão do navegador nem erro só no topo do formulário.

const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Texto do erro em pt-BR a partir do ValidityState. `nome` é o nome do campo com artigo ("o título"). */
export function mensagemValidacao(c, nome = 'este campo') {
  const v = c.validity;
  if (!v || v.valid) return '';
  if (v.customError) return c.validationMessage;
  if (v.valueMissing) return c.type === 'radio' ? `Escolha ${nome}.` : `Preencha ${nome}.`;
  if (v.tooShort) return `${maiuscula(nome)} precisa de pelo menos ${c.minLength} caracteres (agora tem ${c.value.trim().length}).`;
  if (v.tooLong) return `${maiuscula(nome)} pode ter no máximo ${c.maxLength} caracteres.`;
  if (v.badInput) return 'Data incompleta ou inválida. Use dia, mês e ano.';
  if (v.rangeOverflow) return c.type === 'date' ? 'A data não pode ser no futuro.' : c.validationMessage;
  if (v.rangeUnderflow) return c.type === 'date' ? 'Use uma data de até 1 ano atrás.' : c.validationMessage;
  return c.validationMessage;
}

function controlesDe(ctrl) {
  if (!ctrl) return [];
  return typeof RadioNodeList !== 'undefined' && ctrl instanceof RadioNodeList ? [...ctrl] : [ctrl];
}

export function mostrarErroCampo(ctrl, msg) {
  const lista = controlesDe(ctrl);
  const primeiro = lista[0];
  const caixa = primeiro?.closest('.campo');
  if (!caixa) return null;
  const idErro = `erro-${primeiro.form?.id || 'f'}-${primeiro.name || primeiro.id}`;
  let p = caixa.querySelector(':scope > .erro-campo');
  if (!p) {
    p = el('p', { class: 'erro-campo', id: idErro }, icone('alerta'), el('span', {}));
    caixa.append(p);
  }
  p.lastElementChild.textContent = String(msg);
  for (const c of lista) {
    c.setAttribute('aria-invalid', 'true');
    if (c.dataset.descricaoBase === undefined) c.dataset.descricaoBase = c.getAttribute('aria-describedby') ?? '';
    c.setAttribute('aria-describedby', [c.dataset.descricaoBase, idErro].filter(Boolean).join(' '));
  }
  return primeiro;
}

export function limparErroCampo(ctrl) {
  const lista = controlesDe(ctrl);
  lista[0]?.closest('.campo')?.querySelector(':scope > .erro-campo')?.remove();
  for (const c of lista) {
    c.removeAttribute('aria-invalid');
    if (c.dataset.descricaoBase !== undefined) {
      if (c.dataset.descricaoBase) c.setAttribute('aria-describedby', c.dataset.descricaoBase);
      else c.removeAttribute('aria-describedby');
      delete c.dataset.descricaoBase;
    }
  }
}

/** Controles do formulário com validação, um por nome (um grupo de rádio conta uma vez). */
function controlesValidaveis(form) {
  const vistos = new Set();
  const saida = [];
  for (const c of form.elements) {
    if (!c.willValidate || !c.name || vistos.has(c.name)) continue;
    vistos.add(c.name);
    saida.push(c.type === 'radio' ? form.elements.namedItem(c.name) : c);
  }
  return saida;
}

const primeiroControle = (ctrl) => controlesDe(ctrl)[0];

/**
 * Valida o formulário inteiro e põe cada erro junto do seu campo. Devolve o primeiro controle
 * inválido (para receber o foco) ou null se estiver tudo certo. `nomes` = { name: "o título" }.
 */
export function validarNoCampo(form, nomes = {}) {
  let primeiro = null;
  for (const ctrl of controlesValidaveis(form)) {
    const c = primeiroControle(ctrl);
    if (c.checkValidity()) { limparErroCampo(ctrl); continue; }
    mostrarErroCampo(ctrl, mensagemValidacao(c, nomes[c.name]));
    primeiro ??= ctrl instanceof Element ? ctrl : (controlesDe(ctrl).find((r) => r.checked) ?? c);
  }
  return primeiro;
}

/**
 * Validação ao sair do campo (blur), não a cada tecla. Depois que um campo mostrou erro,
 * ele é revalidado enquanto a pessoa corrige, e o erro some assim que fica válido.
 */
export function ligarValidacaoNoCampo(form, nomes = {}) {
  const revalidar = (alvo, aoSair) => {
    if (!(alvo instanceof HTMLElement) || !alvo.willValidate || !alvo.name) return;
    const ctrl = alvo.type === 'radio' ? form.elements.namedItem(alvo.name) : alvo;
    const c = primeiroControle(ctrl);
    const temErro = c.getAttribute('aria-invalid') === 'true';
    if (!temErro && !(aoSair && alvo.value !== '' && alvo.type !== 'radio')) return;
    if (c.checkValidity()) limparErroCampo(ctrl);
    else mostrarErroCampo(ctrl, mensagemValidacao(c, nomes[c.name]));
  };
  form.addEventListener('focusout', (e) => revalidar(e.target, true));
  form.addEventListener('input', (e) => revalidar(e.target, false));
  form.addEventListener('change', (e) => revalidar(e.target, false));
}

export function limparErrosCampos(form) {
  for (const ctrl of controlesValidaveis(form)) limparErroCampo(ctrl);
  for (const p of form.querySelectorAll('.erro-campo')) p.remove();
}

/** Marca um botão como ocupado (desabilita e mostra spinner via CSS). */
export function ocupado(botao, sim) {
  if (!botao) return;
  botao.disabled = sim;
  botao.classList.toggle('btn--ocupado', sim);
  if (sim) botao.setAttribute('aria-busy', 'true');
  else botao.removeAttribute('aria-busy');
}

export function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}
