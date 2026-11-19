# Relatório do Agente 3 (Teste e Validação)

- Data: 18/11/2026
- Skill seguida: skills/teste-validacao/SKILL.md
- Harness: chat do Claude (claude.ai), sem modo agente. Papel assumido numa conversa única, junto com os agentes 1 e 2.
- Limitação declarada: o código foi escrito na mesma conversa. Por isso este relatório se apoia em testes que o aluno executou, e não só em leitura de código.

## Testes executados
| # | Teste | Esperado | Resultado |
|---|-------|----------|-----------|
| 1 | POST /api/atividades sem login | 401 | 401 (passa) |
| 2 | GET /api/atividades sem login | 401 | 401 (passa) |
| 3 | GET com cookie forjado (discord_session=abc.def) | 401 | 401 (passa) |
| 4 | node validar-local.mjs P26-2C-7E6D-B4F0-76A5-9594 | 9 itens OK | 9/9 OK (passa) |
| 5 | Navegador: 51 h em Ensino com 10 h já registradas | recusar e manter a barra | mensagem do teto exibida, barra em 10/60 (passa) |

## Achado
- A skill pede códigos 400/401/403/409 para payload inválido ou não autenticado. A API devolvia 422 nas validações e no teto.
- Correção aplicada em functions/api/atividades.js: validações respondem 400 e teto excedido responde 409.

## Limitações
- Os itens 4, 5 e 6 do validar-local.mjs só conferem se os arquivos existem. Eles não provam que agentes foram usados.
- Os testes autenticados (teto e link) foram feitos manualmente no navegador. Não há testes automatizados com cookie válido.