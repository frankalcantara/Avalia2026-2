// Validação pura (sem dependências do runtime) — usada pelas Functions e pelos testes.
export const TIPOS = ['aviso', 'lembrete', 'link'];

const RE_CODIGO = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

const limpar = (v) => (typeof v === 'string' ? v.trim() : '');
const erro = (mensagem) => ({ ok: false, erro: mensagem });

export function validarCodigo(entrada) {
  const codigo = limpar(entrada).toUpperCase();
  if (!RE_CODIGO.test(codigo)) {
    return erro('Código inválido: use 2 a 20 letras, números, "-" ou "_" (ex.: ENG-SOFT).');
  }
  return { ok: true, valor: codigo };
}

export function validarDisciplina(corpo) {
  if (!corpo || typeof corpo !== 'object') return erro('Corpo da requisição inválido.');
  const codigo = validarCodigo(corpo.codigo);
  if (!codigo.ok) return codigo;
  const nome = limpar(corpo.nome);
  if (nome.length < 3 || nome.length > 80) return erro('O nome da disciplina deve ter de 3 a 80 caracteres.');
  return { ok: true, valor: { codigo: codigo.valor, nome } };
}

export function urlHttpValida(texto) {
  try {
    const u = new URL(texto);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function dataValida(texto) {
  if (!RE_DATA.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

export function validarAviso(corpo) {
  if (!corpo || typeof corpo !== 'object') return erro('Corpo da requisição inválido.');
  const tipo = limpar(corpo.tipo);
  if (!TIPOS.includes(tipo)) return erro('Tipo inválido: use aviso, lembrete ou link.');

  const disciplina = validarCodigo(corpo.disciplina);
  if (!disciplina.ok) return erro('Escolha uma disciplina válida.');

  const titulo = limpar(corpo.titulo);
  if (titulo.length < 3 || titulo.length > 120) return erro('O título deve ter de 3 a 120 caracteres.');

  const texto = limpar(corpo.corpo);
  if (texto.length > 2000) return erro('O texto pode ter no máximo 2000 caracteres.');
  if (tipo !== 'link' && texto.length === 0) return erro('Escreva o texto do aviso.');

  let url = null;
  if (tipo === 'link') {
    url = limpar(corpo.url);
    if (url.length > 500 || !urlHttpValida(url)) return erro('Informe um link http(s) válido de até 500 caracteres.');
  }

  let prazo = null;
  if (tipo === 'lembrete') {
    prazo = limpar(corpo.prazo);
    if (!dataValida(prazo)) return erro('Informe a data de entrega no formato AAAA-MM-DD.');
  }

  return { ok: true, valor: { tipo, disciplina: disciplina.valor, titulo, corpo: texto, url, prazo } };
}

export function validarEstado(corpo) {
  if (!corpo || typeof corpo !== 'object') return erro('Corpo da requisição inválido.');
  const valor = {};
  for (const campo of ['lido', 'fixado']) {
    if (corpo[campo] !== undefined) {
      if (typeof corpo[campo] !== 'boolean') return erro(`O campo "${campo}" deve ser verdadeiro ou falso.`);
      valor[campo] = corpo[campo];
    }
  }
  if (Object.keys(valor).length === 0) return erro('Informe "lido" e/ou "fixado".');
  return { ok: true, valor };
}

export function validarId(texto) {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? { ok: true, valor: n } : erro('Identificador inválido.');
}
