// Fonte única da verdade dos selos.
export const BADGES = [
  { id: 'bug-critico', label: 'Resolveu um Bug Crítico', emoji: '🐛' },
  { id: 'otima-explicacao', label: 'Ótima Explicação', emoji: '💡' },
  { id: 'ajuda-projeto', label: 'Ajuda no Projeto', emoji: '🤝' },
  { id: 'code-review', label: 'Code Review Excelente', emoji: '🔍' },
  { id: 'trabalho-equipe', label: 'Espírito de Equipe', emoji: '🚀' },
  { id: 'mentoria', label: 'Mentoria', emoji: '🎓' },
];

export function getBadge(id) {
  return BADGES.find((b) => b.id === id) || null;
}
