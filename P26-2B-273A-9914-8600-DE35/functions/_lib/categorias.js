/**
 * Lista fechada de categorias — P26-2B-273A-9914-8600-DE35
 *
 * Fica aqui, e nao como CHECK no banco, de proposito: a lista muda a cada
 * semestre conforme as materias da turma, e um CHECK exigiria uma migration
 * nova a cada mudanca. Tipo (resumo/snippet) tem CHECK no banco porque aquilo
 * nao muda nunca.
 *
 * A validacao acontece no servidor. O <select> da interface e conveniencia
 * para quem usa, nao barreira: qualquer um pode mandar outra coisa no corpo
 * da requisicao, e e esta lista que recusa.
 */

export const CATEGORIAS = [
  // Linguagens
  "JavaScript",
  "Python",
  "Java",
  "C",
  "C++",
  "C#",
  "SQL",
  "HTML/CSS",
  "Shell",
  // Materias
  "Algoritmos",
  "Estrutura de Dados",
  "Banco de Dados",
  "Redes",
  "Engenharia de Software",
  "Arquitetura",
  "Matematica",
  "Outros",
];

export const TIPOS = ["resumo", "snippet"];

export function categoriaValida(valor) {
  return CATEGORIAS.includes(valor);
}

export function tipoValido(valor) {
  return TIPOS.includes(valor);
}
