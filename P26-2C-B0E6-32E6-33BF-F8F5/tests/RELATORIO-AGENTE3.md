\# Relatório de Avaliação



\## 1. Resumo



| Item | Resultado |

| :--- | :--- |

| \*\*Testes da API\*\* \*(local, D1 local, sessões assinadas por script)\* | 70 executados, 70 aprovados, 0 falhas |

| \*\*Fluxo OAuth até o redirect, em produção\*\* | Comprovado (EV-1) |

| \*\*Sessão assinada e cookie adulterado em produção\*\* | Comprovado (`session.js`, EV-2) |

| \*\*`validar-local.mjs`\*\* | Sem aprovação evidenciada. A saída é um erro (EV-5) |

| \*\*`AGENTS.md`\*\* | Harness e modelos em branco |

| \*\*Frontend\*\* | Só `index.html` foi visto. `app.js` e `styles.css` não foram enviados |



\### Parecer

\* \*\*API:\*\* Aprovada no ambiente local.

\* \*\*Entrega:\*\* Completa.

\* \*\*Limite do teste:\*\* Tudo da API foi exercitado contra D1 local, não contra produção.



\### Método

\* O arquivo `tests/validar-api.mjs` foi escrito pelo aluno a partir do plano fornecido.

\* A numeração foi reorganizada em relação ao plano original, portanto a correspondência foi feita por descrição.



\---



\## 2. Resultado por Bloco (API, Local)



| Bloco | Tema | Testes | OK | Observações |

| :---: | :--- | :---: | :---: | :--- |

| \*\*1\*\* | Sem login e Origin | 8 | 8 | `401` sem cookie. `403` sem `Origin` ou com `Origin` alheio, mesmo logado. `PUT` e `PATCH` retornam `405`. |

| \*\*2\*\* | Criação de slots e listagem | 16 | 16 | Idempotência (`created:0`). Rejeita tipos inválidos, não múltiplos de 30 min, janela maior que 8 h, passado, mais de 60 dias, JSON quebrado, array e corpo maior que 4 KB (`413`). Intervalo de listagem vazio ou maior que 8 dias: `400`. |

| \*\*3\*\* | Reservas e privacidade | 14 | 14 | Valida `slot\_id` e tema. `404` para slot inexistente, `403` para o próprio horário, `409` para duplicata. Outro aluno vê o slot ocupado com `topic:null` e `student:null`. O monitor vê tema e nome. |

| \*\*4\*\* | Corrida | 3 | 3 | 12 requisições simultâneas de 2 alunos: 1×`201` e 11×`409`. Sem duplicata no banco. `UNIQUE(slot\_id)` presente. |

| \*\*5\*\* | Sobreposição do mesmo aluno | 3 | 3 | Reserva em $T$: `201`. Mesmo horário com outro monitor: `409`. Adjacente ($T + 30\\text{ min}$): `201`. |

| \*\*6\*\* | Cancelamento e autoria | 7 | 7 | Terceiro cancelando reserva alheia: `403`. Aluno e monitor do slot: `204`. Repetir: `404`. IDs `abc`: `404`. |

| \*\*7\*\* | Remoção de slot | 5 | 5 | Slot com aluno: `409`. Não autor: `403`. Livre: `204`. Após cancelamento: `204`. |

| \*\*8\*\* | Limite de 10 reservas | 5 | 5 | Sequencial: 10×`201` e depois `409`. Após cancelar uma, a 11ª passa. Paralelo (12 simultâneas): 10×`201` e 2×`409`. |

| \*\*9\*\* | Horários passados | 3 | 3 | Reservar slot passado: `400`. Cancelar slot já iniciado: `400`. Reserva passada não aparece na lista. |

| \*\*10\*\* | Limite de 200 slots | 3 | 3 | 14 janelas de 16 slots (224 pedidos), todas com `201`. Total criado: 200, confirmado no banco. |

| \*\*11\*\* | Robustez | 3 | 3 | Tema com HTML aceito (`201`) e devolvido sem alteração. `PATCH`: `405`. |

| \*\*Total\*\* | — | \*\*70\*\* | \*\*70\*\* | \*\*100% de aprovação nos testes executados.\*\* |

