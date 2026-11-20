# Relatorio de QA - Projeto #33

Projeto: P26-2C-6503-DF96-B025-1EBF

| item verificado | resultado | observação |
|---|---|---|
| Isolamento da subpasta | OK | O trabalho deste projeto foi limitado a `P26-2C-6503-DF96-B025-1EBF/`; não foram alterados arquivos de produção. |
| Login Discord OAuth2 | OK | As rotas iniciam o fluxo, validam `state`/CSRF, trocam o code e criam uma sessão HttpOnly. |
| Mural público | OK | `GET /api/messages` é público e os 15 casos originais, mais os novos casos, confirmam também publicação autenticada e validação. |
| Cápsulas com data de desbloqueio | OK | Datas passadas, inválidas, inferiores a um minuto e superiores a 30 anos são validadas ou tratadas corretamente. |
| Cápsula trancada sem `content` | OK | As respostas de criação e listagem trancada não incluem `content` nem vazam o texto secreto. |
| Virada temporal | OK | Ao mover a data para o passado no banco, a mesma cápsula passa a entregar `content`. |
| Anti-manipulação POST/PUT/PATCH | OK | POST sem login, origem cruzada, JSON malformado, título/conteúdo/audiência inválidos e limites são rejeitados; não existem handlers PUT/PATCH nas rotas `/api/*` analisadas. |
| Cliente HTML/CSS/JS puro | OK | O frontend usa HTML, CSS e JavaScript vanilla, sem React, Vue, Angular, Svelte ou outros frameworks proibidos. |
| Chave no README.md | OK | A chave única aparece no README da subpasta. |
| Chave no rodapé | OK | O rodapé de `public/index.html` contém a chave única. |
| LICENSE MIT | OK | O arquivo `LICENSE` da subpasta contém a licença MIT completa. |
| AGENTS.md com pelo menos 3 agentes | OK | O documento registra 3 agentes e seus papéis. |
| Skills `skills/*/SKILL.md` | OK | Existem arquivos SKILL.md para serverless/D1/Discord, interface vanilla e teste/validação. |
| Teste funcional `node tests/capsules.test.mjs` | OK | 17 testes passaram; foram adicionados 2 casos para JSON malformado e origem cruzada no mural. |
| Validador local na raiz | OK | `node validar-local.mjs P26-2C-6503-DF96-B025-1EBF` aprovou integralmente os 9 itens estruturais. |
