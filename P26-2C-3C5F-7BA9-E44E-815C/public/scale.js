// Escalonador de porções: regra de três simples sobre a quantidade base.
export function scaleAmount(amount, baseServings, desiredServings) {
  return (amount * desiredServings) / baseServings;
}

// Arredonda para 2 casas e usa vírgula decimal (pt-BR). 1.5 -> "1,5"
export function formatAmount(n) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
