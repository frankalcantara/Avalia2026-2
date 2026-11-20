export const FUSO = "America/Sao_Paulo";
const DIAS_MAXIMOS_NO_FUTURO = 60;

export function hojeSP(agora = new Date()) {
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO });
}

export function agoraSP(agora = new Date()) {
  return agora.toLocaleString("sv-SE", { timeZone: FUSO }).slice(0, 16);
}

export function limparTexto(valor, minimo, maximo) {
  if (typeof valor !== "string") return null;
  const texto = valor.trim().replace(/\s+/g, " ");
  if (texto.length < minimo || texto.length > maximo) return null;
  return texto;
}

export function idValido(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => "\\" + c);
}

export function saidaJaPassou(data, horario, agora = new Date()) {
  return `${data} ${horario}` < agoraSP(agora);
}

export function validarRota(corpo, agora = new Date()) {
  const erros = [];
  const origem = limparTexto(corpo?.origem, 2, 60);
  if (!origem) erros.push("Informe o bairro de origem (2 a 60 caracteres).");

  const destino = limparTexto(corpo?.destino, 2, 60);
  if (!destino) erros.push("Informe o destino (2 a 60 caracteres).");

  if (origem && destino && origem.toLowerCase() === destino.toLowerCase()) {
    erros.push("Origem e destino precisam ser diferentes.");
  }

  const data = typeof corpo?.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.data) ? corpo.data : null;
  const horario = typeof corpo?.horario === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(corpo.horario) ? corpo.horario : null;
  if (!data) erros.push("Informe uma data válida.");
  if (!horario) erros.push("Informe um horário de saída válido (HH:MM).");

  if (data && horario) {
    const saida = new Date(`${data}T${horario}:00-03:00`);
    if (Number.isNaN(saida.getTime()) || hojeSP(saida) !== data) {
      erros.push("A data informada não existe.");
    } else if (saidaJaPassou(data, horario, agora)) {
      erros.push("O horário de saída já passou.");
    } else if (saida.getTime() - agora.getTime() > DIAS_MAXIMOS_NO_FUTURO * 86400000) {
      erros.push(`A data pode ser no máximo ${DIAS_MAXIMOS_NO_FUTURO} dias à frente.`);
    }
  }

  const vagas = Number(corpo?.vagas);
  if (!Number.isInteger(vagas) || vagas < 1 || vagas > 8) {
    erros.push("O número de vagas deve ser um inteiro de 1 a 8.");
  }

  return { ok: erros.length === 0, erros, valores: { origem, destino, data, horario, vagas } };
}
