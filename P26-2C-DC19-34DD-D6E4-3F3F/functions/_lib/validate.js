// Validação de entrada. Retorna { ok: true, value } ou { ok: false, error, field }.

const LIMITES = {
  titulo: { min: 5, max: 120 },
  corpo: { min: 10, max: 5000 },
  resposta: { min: 3, max: 5000 },
};

function texto(valor, campo, rotulo, { min, max }) {
  if (typeof valor !== "string") return { ok: false, error: `${rotulo} é obrigatório.`, field: campo };
  const v = valor.trim();
  const n = Array.from(v).length;
  if (n < min || n > max) {
    return { ok: false, error: `${rotulo} deve ter entre ${min} e ${max} caracteres.`, field: campo };
  }
  return { ok: true, value: v };
}

export const validarTitulo = (v) => texto(v, "title", "O título", LIMITES.titulo);
export const validarCorpo = (v) => texto(v, "body", "A descrição", LIMITES.corpo);
export const validarResposta = (v) => texto(v, "body", "A resposta", LIMITES.resposta);

// Inteiro positivo seguro a partir de número ou string de dígitos; senão null.
export function parseId(v) {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? v : null;
  if (typeof v === "string" && /^[1-9]\d{0,15}$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}
