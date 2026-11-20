# Histórico do Projeto #23

## 20 de novembro de 2026 | Primeira etapa

Três subagentes foram executados nesta sessão. A ferramenta de colaboração os iniciou por nome. Cada um leu o TOML do papel correspondente e aplicou sua skill no workspace compartilhado. O carregamento nativo dos perfis TOML pelo executor do Codex ficou fora desta execução.

| Subagente executado | Skill aplicada | Tarefa e resultado |
| --- | --- | --- |
| `/root/frontend` | [frontend-referencias](../.agents/skills/frontend-referencias/SKILL.md) e `sites:sites` para o fluxo local | Criou a [interface inicial](../dist/index.html) em HTML5, CSS3 e JavaScript puro. O formulário aceita livro ou página da web, valida campos, gera prévia ilustrativa em ABNT ou IEEE e permite copiá-la. Executou `node --check dist/app.js` com sucesso. Retornou para alinhar a regra de ano após o achado de testes. |
| `/root/backend` | [backend-referencias](../.agents/skills/backend-referencias/SKILL.md) | Produziu o [plano de backend](plano-backend.md) com modelo e migrações D1, contrato proposto de Pages Functions, fluxo Discord OAuth2, sessões e autorização por projeto. Consultou a documentação oficial e conferiu o arquivo gravado. |
| `/root/testes` | [testes-referencias](../.agents/skills/testes-referencias/SKILL.md) | Revisou a interface e o plano. Executou `node --check dist/app.js` e verificações em `node -` com VM e DOM simulado. Identificou a divergência na validação do ano e confirmou a correção em novo teste. |

### Resultados da revisão

- Aprovados em DOM simulado os fluxos de campo obrigatório com foco, exemplo ABNT para livro, cópia simulada, troca do tipo de fonte com invalidação da prévia, rejeição de URL FTP e exemplo IEEE para página web.
- O formulário aceitava `0999` pelo padrão HTML, enquanto o JavaScript o rejeitava. O subagente `frontend` alinhou a regra para quatro algarismos e o subagente `testes` confirmou que HTML e JavaScript passaram a aceitar o mesmo valor. O reteste terminou com código de saída 0.
- A revisão do plano identificou pontos a definir antes da integração, incluindo exemplos normativos, regras para autoria institucional ou ausente, data de acesso e critérios de ordenação como localidade, acentos e desempate.
- Ficaram pendentes testes em navegador real, conformidade normativa ABNT e IEEE, ordenação executável, APIs, persistência no D1 e autenticação Discord. A etapa teve apenas frontend local e planejamento de backend, sem login real, provisionamento ou deploy.

## 20 de novembro de 2026 | Etapa 2

Os três subagentes foram executados no harness Codex com workspace compartilhado. Cada um consultou a especificação, o perfil TOML correspondente e sua skill. A ferramenta de colaboração iniciou os papéis por nome, sem carregamento nativo dos perfis TOML.

| Subagente | Skill | Trabalho e evidência |
| --- | --- | --- |
| `/root/frontend` | `frontend-referencias` e `sites:sites` em modo local | Atualizou os formulários de livro, artigo de periódico e página web, integrou a prévia aos segmentos do formatador, aplicou grifo e permitiu copiar a referência em texto simples. Inseriu a chave no rodapé. Em Chrome headless local, verificou os seis fluxos, a troca de fonte, o foco e a indicação de erro, a cópia real, o teclado e as larguras de 320, 768 e 1280 px. |
| `/root/backend` | `backend-referencias` | Implementou o formatador compartilhado, a compilação alfabética, APIs de projetos e referências com sessão e autorização por proprietário e a migração SQL. Consultou ABNT NBR 6023:2025 e IEEE Reference Guide. Executou 22 asserções exploratórias em Node/SQLite. Corrigiu os casos de página web apontados por testes e preservou a aceitação do ano `0999`. |
| `/root/testes` | `testes-referencias` | Criou e executou as suítes bibliográfica e de API. Identificou divergências no grifo ABNT e na data de acesso IEEE para web, solicitou as correções e conferiu o desempate explícito da ordenação. Reteste com 13 aprovações e zero falhas. |

O [relatório de testes](testes-etapa-2.md) registra os comandos, os casos normativos, os resultados e os limites. Os testes da API chamaram o handler com sessões de fixture e um adaptador SQLite, com persistência depois de reabrir o banco. O runtime Pages/D1 da Cloudflare, a integração dos projetos na interface, a cópia integral da bibliografia e o login Discord continuam pendentes. Esta etapa ocorreu sem credenciais reais ou deploy.

## 20 de novembro de 2026 | Etapa 3

Os três subagentes foram executados no harness Codex em workspace compartilhado. Cada um leu a especificação, o perfil TOML e a skill correspondente. A ferramenta de colaboração iniciou os subagentes por nome. Os perfis TOML foram aplicados por leitura.

| Subagente | Skill aplicada | Tarefa e resultado |
| --- | --- | --- |
| `/root/frontend` | `frontend-referencias` e `sites:sites` em modo local | Integrou seleção e CRUD de projetos e referências à API. Adicionou estados de sessão, mensagens de sucesso e erro, bibliografia atualizada automaticamente e botões distintos para compilar e copiar. A cópia usa texto simples e a prévia mantém o grifo. Verificou a interface no Chromium. |
| `/root/backend` | `backend-referencias` | Acrescentou a rota de bibliografia com autorização por proprietário, ordenação alfabética, numeração IEEE e saída em texto e segmentos. Preservou a validação no servidor e acrescentou proteção contra sobrescrita concorrente em PATCH. Documentou o contrato da sessão futura em [plano-backend.md](plano-backend.md) e verificou o handler com SQLite local. |
| `/root/testes` | `testes-referencias` e orientação de prévia local de `sites:sites` | Exercitou o handler real e o frontend em Chrome headless. Registrou a normalização de quebras de linha do clipboard do Windows, cobriu o botão de recompilação após o ajuste e confirmou o fluxo de cópia, inclusive a mensagem de recuperação quando a permissão é negada. O reteste final teve 21 aprovações e zero falhas. |

O [relatório da Etapa 3](testes-etapa-3.md) registra a execução reproduzível, as evidências e os limites. Os testes cobriram CRUD, isolamento entre contas, sessão ausente, falhas de validação e serviço, atualização concorrente e bibliografia completa. O ambiente usou Chrome headless e o handler de Pages Functions com um adaptador SQLite e sessões de fixture restritas aos testes. A etapa ocorreu sem credenciais reais, login Discord real ou deploy.

## 20 de novembro de 2026 | Etapa 4

Os três subagentes foram executados no harness Codex em workspace compartilhado, após consultar a especificação e ler seus perfis TOML. A ferramenta de colaboração iniciou cada subagente por nome.

| Subagente | Skill aplicada | Trabalho e evidência |
| --- | --- | --- |
| `/root/backend` | `backend-referencias` | Implementou Discord Authorization Code com PKCE S256, tentativa expirada e de uso único vinculada ao navegador, consulta de perfil e sessão opaca com hash no D1. Preservou ID Discord, nome de usuário, nome de exibição e avatar. O logout revoga a sessão. Preparou o binding `DB`, a migração e a proteção de arquivos de ambiente. Wrangler 4.165.0 aplicou as duas migrações no D1 local, compilou as Functions e confirmou em HTTPS página pública, sessão anônima, configuração OAuth ausente e proteção de projetos. |
| `/root/frontend` | `frontend-referencias` e `sites:sites` em modo local | Integrou botão de entrada, perfil, avatar com alternativa, mensagens de retorno e logout. A sessão consultada no servidor controla o acesso à área de trabalho. Os fluxos de projetos, referências e bibliografia foram exercitados na regressão em Chromium. |
| `/root/testes` | `testes-referencias` e orientação de prévia local de `sites:sites` | Executou OAuth, sessão, migração, autorização, persistência e regressão no Node e no Chrome HTTPS. O navegador recebeu o cookie no callback da aplicação e verificou entrada, perfil, acesso aos projetos e saída. O Discord externo foi interceptado no harness. Foram 26 aprovações e zero falhas. |

O [relatório da Etapa 4](testes-etapa-4.md) registra os testes executados, as evidências e o roteiro manual. A [configuração do backend](plano-backend.md#oauth2-e-execução-local-na-etapa-4) descreve o binding, as migrações e as variáveis. O login com o Discord real e o D1 remoto continuam pendentes. A etapa ocorreu sem inserir credenciais reais e sem deploy.

## 20 de novembro de 2026 | Integração à pasta oficial

O agente principal do Codex integrou a aplicação à pasta `P26-2B-CF46-EB49-68C0-7D86` com autorização de escrita. Os agentes mencionados acima são os executados nas etapas de desenvolvimento. Os caminhos antigos nos registros se referem à estrutura dessas etapas. O diretório ativo agora é `public/`, os skills específicos estão em `skills/` e as migrações bibliográficas são 0002 e 0003.

- `node --test tests/*.test.mjs` na pasta oficial com Node.js 26.13.1 e Chrome 157.0.8103.79 aprovou 26 testes, com zero falhas e zero cancelamentos. O ensaio inicial na cópia temporária teve 18 aprovações e dois timeouts de navegador. A repetição autorizada validou login HTTPS com Discord simulado, sessão, logout, projetos, referências, isolamento, ABNT e IEEE, ordenação e cópia.
- O Wrangler 4.165.0 aplicou 0001, 0002 e 0003 em D1 local vazio. Em outro D1 local, aplicou primeiro 0001, gravou um registro do scaffold e aplicou 0002 e 0003. A consulta posterior confirmou a preservação do registro e a presença das cinco tabelas novas.
- A prévia `wrangler pages dev public` serviu a página com a chave oficial (200), retornou visitante em `/api/session` e rejeitou `/api/projects` sem sessão (401). As rotas de login e callback chegaram ao roteador ativo e redirecionaram com 303 para `/?auth=unavailable` na ausência de configuração OAuth.
- O validador oficial, executado na raiz do repositório com a chave do Projeto #23, aprovou os oito critérios locais. O item 9, deploy online, ficou pendente. Na primeira execução, a detecção de agentes ficou pendente porque o documento usava uma tabela sem títulos individuais. A repetição após a inclusão dos títulos aprovou esse critério.
- A conferência SHA-256 confirmou a preservação dos nove arquivos arquivados, da licença MIT e da migração oficial. A árvore ativa de Functions contém apenas o roteador bibliográfico e seus dois módulos auxiliares.

## 20 de novembro de 2026 | Investigação do callback Discord em produção

O agente principal iniciou `/root/backend23` e `/root/testes23` no harness Codex. Eles aplicaram, respectivamente, `backend-referencias` e `testes-referencias`. A investigação partiu da revisão `9251527`.

No código inspecionado, o HTTP 303 com `/?auth=failed` e a limpeza do cookie temporário só ocorre após configuração aceita, validação de parâmetros e consumo no D1 de uma tentativa válida vinculada ao navegador. A URI configurada precisa coincidir com a origem HTTPS e o caminho do callback. A requisição de troca usa a mesma URI da autorização e o verificador PKCE armazenado. O sintoma, sozinho, não comprova que o Discord aceitou essa requisição. Erros na troca, na leitura ou validação do token e do perfil, e na gravação da sessão convergem para o mesmo redirecionamento.

O Backend adicionou o evento interno `discord_oauth_callback_failed` com uma etapa fixa (`token_exchange`, `token_response`, `profile_request`, `profile_response` ou `session_write`). O evento pode incluir o status HTTP do provedor e, na troca, um código OAuth de uma lista permitida. A resposta pública e as verificações de state, PKCE e URI foram preservadas. A emissão do cookie exige uma gravação de sessão confirmada. A revogação da sessão anterior depende da existência da nova no mesmo lote D1.

Testes reproduziu o redirecionamento com falhas simuladas do Discord e do D1. A suíte completa na pasta oficial (`node --test tests/*.test.mjs`, Node.js 26.13.1, Chromium 157.0.8103.79) aprovou 31 testes, com zero falhas e zero cancelamentos. Os nove testes OAuth verificaram a classificação sanitizada, a preservação da sessão anterior quando a nova inserção não produz registro e os fluxos de login, validação e saída. O validador oficial aprovou os oito critérios locais. O item de publicação ficou pendente para a URL indicada no README.

A causa específica da execução em refhub-projeto-23.pages.dev continua sem confirmação. Uma observação futura deve usar apenas os campos sanitizados do evento. A saída completa de logs de requisição pode conter a query do callback. Esta investigação não publicou mudanças nem usou credenciais reais.

## 20 de novembro de 2026 | Investigação de token_exchange

O Codex acionou `/root/backend_token` e `/root/testes_token`. A revisão confirmou o POST form URL-encoded para `https://discord.com/api/oauth2/token`, autenticado no corpo com ID e segredo do cliente, `grant_type=authorization_code`, URI de retorno da configuração e verificador vinculado à tentativa. Os testes recalcularam o desafio S256 a partir do verificador enviado.

O evento da Cloudflare informado continha somente `stage: token_exchange`. Se esse registro estiver completo e vier da versão inspecionada, o ramo executado foi a rejeição de fetch antes que uma resposta HTTP ficasse disponível ao callback. Qualquer resposta HTTP de erro nesse código registra status numérico. A causa da rejeição continua indeterminada. Para confirmar a interpretação, são necessários a revisão do deploy e os campos sanitizados do evento completo. O diagnóstico agora registra `httpStatus: null` explicitamente quando a troca não entrega uma resposta. Com resposta HTTP de erro, registra o status e, quando permitido, o código OAuth. A autenticação do cliente, state e PKCE foram mantidos.

A suíte testou `invalid_client` (401), `invalid_grant` (400), `invalid_request` (400), corpo não JSON, código fora da lista permitida e rejeição de fetch. A execução paralela teve 37 aprovações e um timeout de navegador. A execução final em série, `node --test --test-concurrency=1 tests/*.test.mjs`, passou 38 testes sem falhas ou cancelamentos, com Chrome 157.0.8103.79 e Discord simulado. Nenhuma credencial foi redefinida e nenhuma mudança foi publicada.

## 20 de novembro de 2026 | Compatibilidade do transporte no deploy 85ccbe4e-e097-47b1-a578-caee7f1bb5e8

O Codex acionou `/root/backend_transport` e `/root/testes_transport`. O evento informado registrava `stage: token_exchange` e `httpStatus: null`. A implementação usava `redirect: 'error'`, opção que o runtime Workers rejeita com TypeError antes de transmitir a requisição. Uma sonda Miniflare/workerd com a data de compatibilidade 2026-03-01 reproduziu o erro. Com `manual`, o servidor simulado recebeu exatamente um POST, respondeu 307 e não recebeu requisições no destino do redirecionamento. A sonda também exercitou AbortController e criou AbortSignal.timeout dentro do contexto da requisição. [Contrato de Request do Workers](https://developers.cloudflare.com/workers/runtime-apis/request/).

O backend passou a usar `redirect: 'manual'` e rejeita 3xx. O evento mantém o status e informa, para exceções anteriores à resposta, a categoria de preparação, fetch ou timeout e um nome de uma lista permitida. Nomes desconhecidos são registrados como UnknownError. O código não registra mensagens de exceção, credenciais ou dados sensíveis do fluxo.

Passaram 22 testes OAuth e 44 testes na suíte em série, com Discord simulado, SQLite e Chromium. A sonda demonstra a falha local antes de qualquer comunicação com o Discord. O fluxo corrigido em produção permanece sem verificação. Esta etapa não realizou commit, push ou deploy.

## Validação final em produção — 20/11/2026

### Correção e autenticação Discord OAuth2

- Identificada e reproduzida incompatibilidade da opção `redirect: 'error'` com o runtime Cloudflare Workers.
- Corrigida a requisição utilizando `redirect: 'manual'`, com rejeição explícita de redirecionamentos HTTP 3xx.
- Login real com Discord OAuth2 confirmado na aplicação publicada.
- Nome de usuário e avatar carregados corretamente após a autenticação.

### Testes funcionais em produção

- Criação e persistência de projetos confirmadas após atualização da página.
- Geração de referências bibliográficas ABNT e IEEE verificada.
- Testados os tipos de fonte: livros, artigos científicos e páginas da web.
- Cadastro, edição, exclusão e persistência de referências confirmados.
- Compilação de bibliografia em ordem alfabética verificada.
- Cópia da bibliografia em texto simples realizada com sucesso.

### Validação automatizada e entrega

- Suíte automatizada: **44 testes aprovados**.
- Validador oficial `validar-local.mjs`: **9 de 9 critérios aprovados**.
- Pull Request oficial criado exclusivamente com os arquivos do Projeto 23.
- Verificação automática do GitHub concluída com sucesso.
- Pull Request aguardando avaliação do professor.

**Aplicação publicada:** https://refhub-projeto-23.pages.dev

**Chave única:** `P26-2B-CF46-EB49-68C0-7D86`

**Observação:** os testes funcionais descritos foram realizados manualmente na aplicação publicada. A aprovação do validador estrutural e das verificações automáticas não equivale à atribuição da nota final.

### Auditoria de segurança da entrega

- Auditoria realizada na branch `entrega-projeto-23`.
- Inspecionados 63 arquivos rastreados e 176 conteúdos distintos em 23 commits.
- Nenhuma credencial real identificada nos arquivos ou no histórico analisado.
- Identificadores públicos, referências a variáveis de ambiente e credenciais fictícias de testes foram classificados separadamente.
- Confirmada a ausência da pasta do Projeto 0 no Pull Request oficial.
- Nenhuma rotação de credenciais ou reescrita do histórico foi considerada necessária.
- Segredos de produção permanecem configurados no ambiente privado da Cloudflare.

**Resultado:** nenhuma exposição de credenciais identificada no escopo auditado.