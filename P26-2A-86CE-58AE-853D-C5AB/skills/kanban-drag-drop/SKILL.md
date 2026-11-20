---
name: kanban-drag-drop
description: Regras para movimentar cartões no quadro Kanban com HTML5 Drag and Drop, persistência imediata e alternativa acessível por botões.
---

# Skill: Movimentação de Cartões Kanban

## Regras Obrigatórias
1. **Colunas fixas:** Usar somente `a_fazer`, `em_execucao` e `concluido`.
2. **Prioridades fixas:** Usar somente `baixa`, `media` e `alta`.
3. **Arrastar e soltar nativo:** Implementar movimentação exclusivamente com a HTML5 Drag and Drop API. No evento `dragover`, chamar `event.preventDefault()` para permitir o destino da soltura.
4. **Ordenação por posição:** A posição é um número real. Ao inserir entre as posições A e B, calcular `(A+B)/2`; no topo, usar `primeiro - 1`; no fim, usar `último + 1`.
5. **Persistência imediata:** Toda mudança de coluna ou posição chama imediatamente `PATCH /api/cartoes/:id`. Se a chamada falhar, recarregar a lista de cartões do servidor para restaurar o estado correto.
6. **Texto seguro:** Exibir texto fornecido pelo usuário sempre com `textContent`; não inseri-lo como HTML.
7. **Alternativa acessível:** Disponibilizar botões para mover cartões, além do arrasto.
