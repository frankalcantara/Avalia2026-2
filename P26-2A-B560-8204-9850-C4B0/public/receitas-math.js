/**
 * Funções puras do escalonador de porções do Projeto #28.
 *
 * Chave Única: P26-2A-B560-8204-9850-C4B0
 *
 * Este módulo NÃO toca no DOM: pode ser importado diretamente pelo Node
 * (`node --test`) para testes automatizados, além de ser consumido pelo
 * `app.js` no navegador. Quando executado no navegador, também publica as
 * funções em `window.ReceitasMath` para inspeção manual/console.
 *
 * Regra de ouro: a quantidade original do ingrediente (`quantidadeBase`)
 * NUNCA é sobrescrita. O cálculo sempre parte do valor base e do rendimento
 * base da receita, evitando acúmulo de erro de arredondamento.
 *
 * @module public/receitas-math
 */

/** Casas decimais usadas na etapa intermediária do cálculo. */
export const PRECISAO_ESCALA = 4;

/** Formatador pt-BR exigido pelo contrato (máximo de 2 casas decimais). */
const FORMATADOR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/**
 * Multiplica um número por uma potência de 10 mantendo precisão controlada.
 *
 * @param {number} valor Valor de entrada.
 * @param {number} expoente Expoente (positivo ou negativo).
 * @returns {number} Valor deslocado.
 */
function deslocar(valor, expoente) {
  return valor * 10 ** expoente;
}

/**
 * Arredonda para um número fixo de casas decimais evitando ruído binário.
 *
 * @param {number} valor Valor de entrada.
 * @param {number} [casas] Casas decimais desejadas.
 * @returns {number} Valor arredondado.
 */
function arredondar(valor, casas = PRECISAO_ESCALA) {
  return Math.round(deslocar(valor, casas)) / deslocar(1, casas);
}

/**
 * Calcula a quantidade escalada de um ingrediente.
 *
 * Fórmula: `quantidadeBase * (rendimentoAlvo / rendimentoBase)`
 *
 * @example
 * escalarQuantidade(200, 2, 5); // 500
 * escalarQuantidade(1, 3, 2);   // 0.6667
 *
 * @param {number} quantidadeBase Quantidade original da receita base.
 * @param {number} rendimentoBase Porções para as quais a receita foi escrita.
 * @param {number} rendimentoAlvo Porções desejadas pelo usuário.
 * @returns {number} Quantidade recalculada (0 quando os dados são inválidos).
 */
export function escalarQuantidade(quantidadeBase, rendimentoBase, rendimentoAlvo) {
  const quantidade = Number(quantidadeBase);
  const base = Number(rendimentoBase);
  const alvo = Number(rendimentoAlvo);

  if (!Number.isFinite(quantidade) || !Number.isFinite(base) || !Number.isFinite(alvo)) return 0;
  if (quantidade < 0 || base <= 0 || alvo <= 0) return 0;

  // A razão é usada em precisão cheia; só o RESULTADO é arredondado,
  // evitando que o arredondamento do fator se propague para o ingrediente.
  return arredondar(quantidade * (alvo / base));
}

/**
 * Formata uma quantidade numérica no padrão pt-BR (máximo de 2 decimais).
 *
 * @example
 * formatarQuantidade(0.6667); // "0,67"
 *
 * @param {number} valor Quantidade a exibir.
 * @returns {string} Texto pronto para o DOM.
 */
export function formatarQuantidade(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return "0";
  return FORMATADOR.format(numero);
}

/**
 * Calcula o fator de escala exibido na interface (ex.: "×1,5").
 *
 * @param {number} rendimentoBase Porções da receita original.
 * @param {number} rendimentoAlvo Porções desejadas.
 * @returns {number} Fator arredondado ou 0 quando inválido.
 */
export function fatorEscala(rendimentoBase, rendimentoAlvo) {
  const base = Number(rendimentoBase);
  const alvo = Number(rendimentoAlvo);
  if (!Number.isFinite(base) || !Number.isFinite(alvo) || base <= 0 || alvo <= 0) return 0;
  return arredondar(alvo / base, 2);
}

/** API pública exposta ao navegador (testes manuais no console). */
const API_PUBLICA = Object.freeze({
  escalarQuantidade,
  formatarQuantidade,
  fatorEscala,
  PRECISAO_ESCALA,
});

if (typeof window !== "undefined") {
  window.ReceitasMath = API_PUBLICA;
}
