# Relatório de teste, auditoria de segurança e validação

Data: 12/11/2026 (America/Sao_Paulo). Projeto: **P26-3A-4CE1-8C26-8C01-F50F**.

Responsável nesta etapa: **Agente 3 — Teste, Auditoria de Segurança e Validação**.
Harness: **Codex**, em Windows, Node.js **v24.20.0**. O identificador exato do modelo não foi disponibilizado e não foi inferido.
Instruções aplicadas: [AGENTS.md](./AGENTS.md) e [skill teste-validacao](./skills/teste-validacao/SKILL.md).

## Resultado

**67 testes executados: 61 aprovados e 6 reprovados; código de saída 1.**
Não houve testes ignorados, cancelados ou marcados como TODO. Os 38 testes preexistentes continuam aprovados. Os 29 casos novos de `tests/qa.test.mjs` resultaram em 23 aprovações e 6 reprovações.

As seis reprovações representam cinco achados: o avatar falha em dois cenários, o diagnóstico legado aceita três formas de entrada que o CRUD rejeita, e o documento principal de agentes ainda contém campos de template. As falhas não foram ocultadas nem corrigidas na aplicação.

O único comando executado foi:

```text
node --test tests/*.test.mjs
```

Resumo da execução da suíte ampliada:

```text
tests 67
suites 0
pass 61
fail 6
cancelled 0
skipped 0
todo 0
```

A leitura inicial utilizou temporariamente `tests/qa-inspecao.test.mjs`, para respeitar a restrição de executar somente o comando acima. Nessa primeira execução, a saída foi 39/39: 38 testes preexistentes e um caso auxiliar de leitura. O auxiliar foi removido; ele não integra a contagem final de 67 testes.

## Escopo e método

Foram lidos todos os arquivos em `functions/`, `lib/`, `public/` e `migrations/`, além de `README.md`, `LICENSE`, `AGENTS.md`, das três skills, de `wrangler.jsonc`, de `docs/backend-api.md`, dos testes existentes e de `../validar-local.mjs`. O validador foi somente lido, sem importação nem execução. Sua exigência na skill foi subordinada à restrição explícita do usuário quanto ao comando permitido.

Os testes novos importam os handlers e o middleware reais, aplicam as duas migrações a SQLite `:memory:` com chaves estrangeiras habilitadas e usam um adaptador das operações D1 `prepare/bind/first/all/run/batch`. Dois usuários e sessões válidas/expiradas são preparados exclusivamente em memória. As negativas de segurança comparam o estado das tabelas antes/depois para detectar alterações parciais ou indevidas. As chamadas são objetos `Request` locais, sem servidor HTTP ou rede.

Para XSS, além de verificar as respostas JSON, os testes extraem as funções reais de renderização do frontend e as executam em VM com DOM mínimo que registra `textContent` e recusa inserções HTML. Também há inspeção estática dos pontos de inserção. Isso não equivale a executar um navegador completo. Os testes de avatar executam a função real `checkSession`, usando o perfil fornecido pelo handler real de `/api/auth/me`.

Os testes de OAuth preexistentes simulam as respostas do Discord. Nenhum teste desta etapa autentica no Discord real, conecta ao D1 remoto ou atesta a disponibilidade do deploy. Não foram executados Git, Wrangler, deploy, navegador, chamadas HTTP externas ou subprocessos adicionais.

Arquivos finais produzidos nesta etapa: `tests/qa.test.mjs` e este relatório. Nenhum arquivo de `functions/`, `lib/`, `public/`, `migrations/`, `README.md`, `AGENTS.md` ou `skills/` foi alterado por este agente. O relatório contém sugestões para os responsáveis pela implementação.

## Casos adversariais e de conformidade

Cada identificador abaixo corresponde a um teste nomeado em `tests/qa.test.mjs`. As linhas que agrupam variantes executam todas elas dentro do caso.

| Caso | Tentativa/verificação | Resultado observado |
| --- | --- | --- |
| QA01 | PATCH em coleção de outro usuário, incluindo publicação | **Aprovado:** 404; nenhuma tabela alterada. |
| QA02 | DELETE em coleção de outro usuário | **Aprovado:** 404; nenhuma exclusão ou outra alteração. |
| QA03 | PATCH em link de outro usuário, tentando trazê-lo para coleção própria | **Aprovado:** 404; identidade, título e coleção preservados. |
| QA04 | DELETE em link de outro usuário | **Aprovado:** 404; link preservado. |
| QA05 | Criar/mover link para coleção alheia ou inexistente; mudar título junto da movimentação | **Aprovado:** quatro respostas 404; sem gravação parcial. |
| QA06 | Nove URLs em POST e PATCH: javascript com variação de caixa, data HTML, credenciais completas/somente usuário/codificadas, controle, relativa e file | **Aprovado:** 18 respostas 400; sem alteração. |
| QA07 | Oito status inválidos em POST, PATCH e filtros privado/público | **Aprovado:** 32 respostas 400; sem alteração. |
| QA08 | Dez campos extras em quatro operações: identidade, IDs, timestamps, papel, admin, `__proto__`, `$where` e nome com sintaxe SQL | **Aprovado:** 40 respostas 400/`unknown_fields`; campos identificados; sem alteração. |
| QA09 | Corpos de 32769 bytes e UTF-8 grande, com tamanho omitido ou falsificado em `Content-Length`, nos quatro POST/PATCH do CRUD | **Aprovado:** 16 respostas 413; um corpo válido de exatamente 32768 bytes recebe 201. |
| QA10 | Streaming dividido em chunks acima de 32 KiB nos quatro POST/PATCH do CRUD | **Aprovado:** quatro respostas 413; leitura cancelada; sem gravação. |
| QA11 | Content-Type ausente ou errado em quatro operações do CRUD, com seis variantes | **Aprovado:** 24 respostas 415; sem gravação. |
| QA12 | Cinco Origins falsos em seis escritas do CRUD, POST de diagnóstico e logout | **Aprovado:** 40 respostas 403; dados/sessões preservados. PATCH com a origem correta funciona. |
| QA13 | Cookie ausente, perfil JSON/base64 forjado, token aleatório, token alterado, sessão expirada, duplicata e nome parecido | **Aprovado:** 84 respostas 401 em 12 operações privadas; sem alteração. |
| QA14 | Acesso público com/sem sessão, inclusive sessão do dono e expirada, após revogar publicação | **Aprovado:** coleção inicialmente pública é acessível; após revogação, oito respostas 404 nas duas rotas públicas. DTO público não inclui `user_id`. |
| QA15 | SQL injection em title de POST/PATCH; filtros `collection_id`, `status`, `limit`, parâmetros repetidos e extras | **Aprovado:** títulos preservados como dados literais por bind; 19 filtros recusados com 400; tabelas, privacidade e isolamento preservados. |
| QA16 | XSS em title/summary por POST e PATCH, lido em listagens privada e pública | **Aprovado:** texto literal preservado em JSON `application/json`; armazenar o texto não o executa. |
| QA17 | Renderização privada com title/summary maliciosos e URL javascript | **Aprovado:** usa `textContent`; não cria script/img/svg do payload; somente a URL HTTPS vira link, com `noopener noreferrer`. |
| QA18 | Mesma tentativa na renderização pública | **Aprovado:** texto literal e URL executável sem âncora; sem inserção HTML. |
| QA19 | Avatar personalizado vindo como URL completa de `/api/auth/me` | **Reprovado:** frontend codifica a URL inteira como hash e acrescenta outro `.png`. F01. |
| QA20 | Avatar padrão do Discord vindo como URL completa | **Reprovado:** mesma reconstrução indevida. F01. |
| QA21 | POST autenticado de diagnóstico com 32769 bytes e `Content-Length: 1` | **Reprovado:** esperado 413; observado 201 e um registro inserido. F02. |
| QA22 | POST autenticado de diagnóstico com JSON sob `text/plain` | **Reprovado:** esperado 415; observado 201 e um registro inserido. F03. |
| QA23 | POST autenticado de diagnóstico com campo desconhecido `unexpected` | **Reprovado:** esperado 400; observado 201 e um registro inserido com o conteúdo permitido; campo extra ignorado. F04. |
| QA24 | Frameworks, assets remotos/CDN, sombras em texto e referências locais de HTML | **Aprovado:** scripts/CSS locais existentes; nenhuma dependência proibida ou CDN de recursos de frontend identificada; sem sombras em texto. |
| QA25 | Chave dentro de footer semântico em todas as páginas | **Aprovado:** `public/index.html` e `public/colecao.html`, ambas HTML5 com `lang="pt-BR"`. |
| QA26 | Chave e URL_CLOUDFLARE HTTPS no README; texto da licença MIT | **Aprovado estruturalmente:** domínio pages.dev declarado e licença MIT presente. Disponibilidade da URL não testada. |
| QA27 | Três papéis de agente e links para três skills locais | **Aprovado estruturalmente:** todos presentes, incluindo o papel de teste. Não prova por si só o histórico de execução dos agentes. |
| QA28 | Harness/modelos efetivos preenchidos no AGENTS.md | **Reprovado:** instruções de preenchimento ainda no documento. F05. |
| QA29 | Credenciais literais, formatos reconhecíveis de tokens/chaves e `.dev.vars` | **Aprovado no escopo textual:** nenhum candidato de segredo nem arquivo `.dev.vars` encontrado. Valores sintéticos conhecidos dos testes foram distinguidos de credenciais reais. |

QA21–QA23 ampliam os critérios de validação para o diagnóstico legado. `docs/backend-api.md` afirma que o POST de `/api/status` preserva o contrato da Etapa 1; esses casos não demonstram quebra do contrato das seis rotas novas de coleções/links. Registram diferenças de proteção que exigem decisão explícita dos responsáveis. Os controles de autenticação e Origin do diagnóstico passaram; não foi demonstrado acesso anônimo, CSRF ou alteração de identidade por essas entradas.

## Resultado individual dos testes preexistentes

| Arquivo/caso | Resultado |
| --- | --- |
| api — CRUD de coleções, publicação booleana, DTO e dono | Aprovado |
| api — Nomes únicos por dono e conflito PATCH 409 | Aprovado |
| api — Exclusão de coleção não vazia 409 e integridade | Aprovado |
| api — GET/PATCH/DELETE de coleção alheia 404 | Aprovado |
| api — CRUD de links, padrões, movimentação e DTO | Aprovado |
| api — Criação/movimentação para coleção alheia | Aprovado |
| api — Acesso a link alheio e tentativa de movê-lo | Aprovado |
| api — Filtros combinados por AND e isolamento | Aprovado |
| api — Limite padrão 100, limite menor e limites inválidos | Aprovado |
| api — Rotas públicas expõem somente coleção publicada | Aprovado |
| api — Privadas/inexistentes 404 e revogação da publicação | Aprovado |
| api — Pública vazia e filtro estrito de status | Aprovado |
| api — Operações privadas sem sessão ou com sessão expirada | Aprovado |
| api — Métodos 405 e Allow nas seis rotas | Aprovado |
| api — Origin externo bloqueia escritas sem alterar dados | Aprovado |
| api — Tipos, limites, campos proibidos e PATCH vazio de coleção | Aprovado |
| api — URL, conteúdo, status, identidade e timestamps de link | Aprovado |
| api — UUIDs inválidos nas rotas e filtros | Aprovado |
| api — JSON malformado, mídia incompatível e charset | Aprovado |
| api — Fronteira de 32768 bytes, UTF-8 e Content-Length falso | Aprovado |
| api — Streaming acima do limite sem criar link | Aprovado |
| api — Sintaxe SQL como dados literais e esquema íntegro | Aprovado |
| api — GET de diagnóstico sem perfil ou registros pessoais | Aprovado |
| auth — Fluxo OAuth, state, hash, identidade e revogação | Aprovado |
| auth — Cookies ausentes, antigos, inventados, duplicados ou semelhantes | Aprovado |
| auth — Recusa de sessão expirada pelo servidor | Aprovado |
| auth — Diagnóstico público com D1 indisponível | Aprovado |
| auth — D1 indisponível não cria sessão autenticada | Aprovado |
| auth — POST de diagnóstico anônimo sem inserção | Aprovado |
| auth — Origin externo em diagnóstico e logout | Aprovado |
| auth — State ausente, diferente, malformado ou sem cookie | Aprovado |
| auth — Cancelamento OAuth e código ausente | Aprovado |
| auth — Login requer credenciais e binding D1 | Aprovado |
| auth — Falha de inserção da sessão desfaz o perfil | Aprovado |
| auth — Novo login substitui sessão e atualiza perfil | Aprovado |
| auth — Perfil inválido/falha Discord não emitem sessão | Aprovado |
| auth — Logout idempotente e falha D1 expira cookie | Aprovado |
| auth — Migração 0002: propriedade composta, status, publicação e FK | Aprovado |

## Falhas encontradas e correções sugeridas

### F01 — Média: avatar incompatível com o contrato do backend

Arquivo: `public/app.js:502`. Evidência: QA19 e QA20. O callback OAuth grava uma URL completa em `discord_users.avatar`, e `/api/auth/me` a retorna. `checkSession` trata esse valor como hash e o insere em outra URL do CDN.

Exemplo reproduzido sem rede: `https://cdn.discordapp.com/embed/avatars/0.png` torna-se `https://cdn.discordapp.com/avatars/123456789012345678/https%3A%2F%2Fcdn.discordapp.com%2Fembed%2Favatars%2F0.png.png`. O contrato é incompatível e o carregamento do avatar tende a falhar; o evento de erro o oculta.

Sugestão: consumir a URL completa do contrato, validando protocolo/host permitido antes de atribuir `src`. Manter as iniciais como fallback. A mesma correção deve cobrir avatar personalizado e padrão. A severidade é funcional/de conformidade do perfil, sem evidência de exploração de segurança.

### F02 — Média: diagnóstico sem limite real de corpo de 32 KiB

Arquivo: `functions/api/status.js:49`. Evidência: QA21, 32769 bytes, resposta 201 e uma inserção. `request.json()` lê o corpo inteiro; o `slice(0, 500)` da linha 52 limita somente o texto resultante, depois de alocar/interpretar a entrada.

Sugestão: verificar os bytes efetivamente recebidos em leitura incremental e cancelar acima de 32768 bytes, inclusive quando o cabeçalho é falso ou ausente, retornando 413. Reaproveitar a proteção de leitura do CRUD com um esquema específico para diagnóstico. Impacto: consumo desnecessário de memória/CPU por requisição autenticada; não foi realizado teste de carga ou demonstrada indisponibilidade.

### F03 — Baixa: diagnóstico ignora Content-Type

Arquivo: `functions/api/status.js:49`. Evidência: QA22, JSON com `text/plain` aceito e persistido com 201.

Sugestão: exigir `application/json`, com suporte a parâmetros como charset, e retornar 415 para mídia incompatível. É uma diferença de contrato/validação; autenticação, SameSite e verificação de Origin permanecem relevantes e não foram contornadas no teste.

### F04 — Baixa: diagnóstico aceita campos desconhecidos

Arquivo: `functions/api/status.js:49`, com seleção/coerção de conteúdo em `functions/api/status.js:52`. Evidência: QA23, campo desconhecido aceito junto de conteúdo válido, resposta 201.

Sugestão: definir os campos aceitos no contrato do diagnóstico, validar tipos e rejeitar extras com 400 antes de gravar. Se a tolerância a campos desconhecidos for deliberadamente mantida por compatibilidade com a Etapa 1, documentar a exceção e ajustar o critério de aceitação de forma explícita. O campo extra não foi persistido nem alterou a identidade; este achado não comprova mass assignment.

### F05 — Média para a rubrica: documentação principal de harness/modelos incompleta

Arquivo: `AGENTS.md:7` e `AGENTS.md:8`. Evidência: QA28. Os três papéis e suas skills estão descritos, mas harness/modelos ainda são instruções de preenchimento. `docs/backend-api.md` já registra Codex e três identificadores de agentes; essa informação não foi consolidada no documento principal.

Sugestão: preencher o harness e os modelos efetivamente conhecidos, declarar quando o identificador exato não estiver disponível e relacionar as entregas reais de cada agente. Não inventar histórico para satisfazer a contagem. Rever a afirmação de funcionamento no Cloudflare em `AGENTS.md:34`: esta auditoria fornece evidência local e não atesta produção. Esse ponto pode comprometer a comprovação do requisito de 25 pontos; não foi calculado desconto automático.

### F06 — Baixa, inspeção documental: skill de sessão difere do mecanismo implementado

Arquivo: `skills/serverless-d1-discord/SKILL.md:11`, comparado com `lib/auth.js`, middleware e callback OAuth. A skill exige sessão assinada em cookie; a implementação usa token aleatório opaco, armazena somente o hash SHA-256 no D1 e verifica validade no servidor. Cookie HttpOnly/Secure/SameSite está presente e os testes de falsificação passaram.

Sugestão: alinhar a skill ao mecanismo de sessão efetivamente aprovado, explicando token opaco, hash e expiração/revogação no servidor. A diferença de redação não demonstra que a sessão atual seja insegura.

### F07 — Baixa, inspeção documental: dossiê de etapa não representa toda a interface atual

Arquivo: `docs/backend-api.md`, seção “Diagnóstico e validação”. O texto diz que a interface ainda usa perfil demonstrativo e lista de diagnósticos; a interface lida atualmente consome `/api/auth/me` e exibe a biblioteca real. O documento é identificado como Etapa 2.

Sugestão: explicitar que a descrição é histórica ou atualizar o dossiê final com o frontend atual e os resultados desta auditoria. Os 38 testes informados nesse documento correspondem à suíte anterior, não à suíte ampliada de 67.

## Auditoria da rubrica e da entrega

| Item | Parecer e evidência |
| --- | --- |
| Arquivos dentro da subpasta | Artefatos desta auditoria e arquivos de aplicação inspecionados estão dentro da pasta autorizada. O validador do pai foi apenas lido. Sem Git, não se atesta o isolamento de todos os commits do repositório. |
| HTML5/CSS3/JS puro | Conforme na inspeção de `public/`; duas páginas, dois scripts vanilla e CSS local. |
| Sem frameworks/CDN em public | Conforme para recursos de interface. O CDN oficial do Discord é usado para a imagem de avatar, não para carregar biblioteca de frontend; o contrato dessa imagem contém F01. |
| Sem sombras em fontes | Conforme: não encontrados `text-shadow` ou `filter: drop-shadow(...)`. |
| Chave em footer de todas as páginas | Conforme em `public/index.html` e `public/colecao.html`; checagem dentro do elemento, não apenas busca global. |
| Chave e URL_CLOUDFLARE no README | Presentes. URL declarada: `https://p26-3a-4ce1-8c26-8c01-f50f.pages.dev`. O README ainda orienta confirmar/atualizar a URL real. Online não verificado. |
| Licença MIT | Conforme em `LICENSE`, incluindo permissão e cláusula AS IS. |
| Três agentes, incluindo testes | Há três papéis no AGENTS e três identificadores no dossiê de backend; skills correspondentes existem. Campos principais de harness/modelos pendentes: F05. Nesta etapa atuou o Agente 3, sem criar agentes adicionais. |
| Skills coerentes | UI e teste coerentes com as técnicas usadas, respeitada a restrição de execução. A descrição de sessão assinada precisa alinhamento: F06. |
| Backend Cloudflare + D1 + OAuth2 | Estrutura, binding DB, migrações e OAuth presentes; SQL/FKs e fluxo OAuth cobertos localmente. Sem atestado de execução em Cloudflare. |
| Segurança do CRUD | Não se reproduziu bypass nos ataques definidos: propriedade, publicação, sessão, Origin, tipos, campos, URLs, tamanho e consultas parametrizadas passaram. |
| Diagnóstico legado | Isolamento de identidade/Origin passou; entradas permissivas registradas em F02–F04. GET não devolve perfil nem registros individuais. |
| Segredos | Nenhum candidato encontrado no inventário textual acessível; nenhum `.dev.vars` presente. Ocorrências de segredo/token nos testes são valores sintéticos reconhecidos. Identificadores de banco/cliente não foram classificados como segredo por serem identificadores públicos. |
| Deploy online e 100 pontos | **Não atestados.** O validador foi apenas lido e o ambiente Cloudflare não foi acessado. A pontuação integral não pode ser inferida da existência dos arquivos. |

O inventário de segredos percorre os arquivos locais, incluindo JSON de cache em `.wrangler`, excluindo `.git` e `node_modules`. Busca atribuições literais de credenciais, formatos conhecidos de tokens e cabeçalhos de chaves privadas, sem imprimir valores suspeitos. Não examina histórico Git, variáveis de ambiente ou conteúdo de bancos/cache binários `.sqlite`, `.sqlite-wal` e `.sqlite-shm`; portanto o resultado não é uma certificação de ausência de segredos em todo o histórico ou estado local.

## Limites da conclusão

O validador lido contém nove checagens estruturais/online e busca a chave globalmente no HTML; os testes desta etapa reforçam a verificação de footer por página e registram as incoerências documentais que a contagem automática de títulos não comprova. Não se declara aprovação de 100% da rubrica nem funcionamento em produção com base em SQLite local.

As falhas reproduzidas permanecem abertas para os agentes responsáveis por backend, interface e documentação. Após sua resolução, o mesmo comando autorizado permite verificar os casos novamente; nenhuma correção de aplicação foi feita nesta entrega.
