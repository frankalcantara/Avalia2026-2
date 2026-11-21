Engenharia de Agentes e Harness (P26-2A-A9AC-2CD1-5F84-AC20)

Projeto #11, Controle Financeiro Pessoal. Aluno: Gabriel Teixeira Scholles, RA 2026107946, turma 2A.

1. Harness utilizado
Harness: Claude (Anthropic) no chat web claude.ai, com ambiente de execução de código usado para rodar os testes automatizados.
Modelo: Claude Sonnet 5.5.
Coordenação: cada agente recebe uma skill em skills/ com regras próprias. Os três compartilham o mesmo contrato: tabelas do D1 (migrations/0001_init.sql) e rotas JSON em functions/api/.
Deploy e comandos reais (wrangler, D1, secrets, Discord) foram executados pelo aluno no terminal; os agentes não têm acesso à conta Cloudflare.
2. Agentes e responsabilidades
Agente 1: Arquiteto Serverless, D1 e Discord OAuth2
Skill: skills/serverless-d1-discord/SKILL.md
Entregas: migrations/0001_init.sql, functions/_lib.js, functions/api/auth/*, functions/api/me.js, functions/api/transactions/*.
Decisões: valores em centavos inteiros, validação de tipo, categoria, data e tamanho no servidor, sessão em tabela do D1 (token aleatório guardado como hash SHA-256) e filtro por user_id em todas as consultas.
Agente 2: Interface Web em Vanilla JS
Skill: skills/vanilla-dom-ui/SKILL.md
Entregas: public/index.html, public/styles.css, public/app.js.
Decisões: saldo líquido no painel superior, formulário com validação monetária, filtros por mês e categoria, edição e exclusão, gráfico de barras horizontais feito só com <div> (largura em % do gasto por categoria) e chave única no rodapé.
Agente 3: Teste, Auditoria e Validação (obrigatório)
Skill: skills/teste-validacao/SKILL.md
Entregas: tests/backend.test.mjs (login simulado, CRUD, validações, isolamento entre usuários, proteção de origem, expiração de sessão) e tests/ui.test.mjs (formulário, filtros, gráfico, edição, exclusão e logout, com DOM simulado).
Como rodar: na pasta do projeto, node tests/backend.test.mjs e node tests/ui.test.mjs (Node 22.5 ou superior). Depois, na raiz do repositório, node validar-local.mjs P26-2A-A9AC-2CD1-5F84-AC20.
3. Registro de execução
Agente	Sessão	O que foi feito	Evidência
1	Sessão principal (claude.ai)	Backend e banco	Código em functions/ e migrations/; tests/backend.test.mjs passa
2	Sessão principal (claude.ai)	Interface	Código em public/; tests/ui.test.mjs passa
3	Sessão separada (novo chat no claude.ai) com a skill teste-validacao	Revisão por leitura, em duas rodadas, de public/, functions/ (com callback.js incluído na segunda rodada), migração, wrangler.jsonc, testes e a skill vanilla-dom-ui, quanto a segurança, bugs e requisitos da interface. Feita sobre a versão anterior às correções.	Apenas leitura de código; nenhum teste foi executado pelo auditor. Nenhuma falha grave encontrada. Achados baixos ou informativos: CSRF depende do cabeçalho Origin, falta nosniff nas respostas JSON, truncated com exatamente 500 transações, chamadas ao Discord sem timeout, sessão anterior não revogada no login, valores com ponto ambíguos. Tratados depois: cookie malformado (agora 401), gráfico e total calculados no servidor (antes erravam com mais de 500 transações), erro de banco no login separado do erro do Discord, valor reformatado ao sair do campo, mês validado como AAAA-MM, user_id visível na tela, gráfico só com div e cabeçalhos de segurança em public/_headers. Os demais achados ficaram documentados como conhecidos e aceitos.
4. Casos de teste (resultado real)

Todos passaram em tests/backend.test.mjs e tests/ui.test.mjs.

Caso	Esperado	Resultado
/api/me e /api/transactions sem login	401	Passou
Callback do Discord com state diferente do cookie	volta ao login com erro	Passou
POST com valor 0, -5, abc, 1,234, vazio ou acima do limite	400	Passou
POST com tipo inválido	400	Passou
Categoria de um tipo usada no outro (ex.: Salário em despesa)	400	Passou
Data 2026-02-30 ou 05/11/2026	400	Passou
Descrição com 81 caracteres, descrição que não é texto ou JSON malformado	400	Passou
POST com Origin de outro site	403	Passou
Filtro com mês 2026-13 ou categoria inexistente	400	Passou
Saldo líquido não muda com os filtros	saldo geral	Passou
Usuário B listando transações do usuário A	lista só as suas	Passou
PUT e DELETE em transação de outro usuário	404	Passou
DELETE repetido e id não numérico	404	Passou
Logout e sessão expirada	401 depois	Passou
Cookie sid malformado (%E0%A4%A)	401	Passou
Mais de 500 transações do mesmo usuário	lista cortada em 500 com aviso; gráfico e despesas somam tudo	Passou
Falha no banco durante o login	volta ao login com erro=servidor	Passou
Interface: gráfico 75% e 25%, filtros, edição, exclusão, valor 10500 vira 10.500,00, mês inválido bloqueado	conforme o esperado	Passou
5. Limites dos testes

Os testes usam um D1 simulado em SQLite e um DOM simulado. O funcionamento real com Discord e Cloudflare foi verificado manualmente pelo aluno no site publicado.

O auditor do Agente 3 não recebeu a skill teste-validacao, não verificou o deploy real, o Discord OAuth nem o D1 de produção, e não confirmou que os testes automatizados passam, pois apenas leu o código. A execução dos testes em tests/ foi feita separadamente.