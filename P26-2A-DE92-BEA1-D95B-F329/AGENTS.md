# Engenharia de agentes — Projeto 39

Chave: `P26-2A-DE92-BEA1-D95B-F329`.

## Harness e coordenação

O desenvolvimento foi realizado em 14/11/2026 no **Codex em ChatGPT Work Mode**, com três agentes independentes iniciados pelo orquestrador e executados em sessões de trabalho distintas sobre um checkout compartilhado. Não se trata apenas de três nomes atribuídos a uma única execução.

- Modelo: Codex, família GPT-6. O identificador exato da variante não foi exposto pelo ambiente; nenhum modelo específico é alegado.
- Orquestrador: `/root`, responsável por conferir o enunciado, validar a chave na API oficial, executar o inicializador do professor, definir o contrato, integrar as entregas e verificar publicação e interface.
- Contrato compartilhado: [`docs/API.md`](docs/API.md).
- Propriedade de arquivos: backend em `functions/` e `migrations/`; frontend em `public/`; testes em `tests/` e relatório de validação. Isso permite trabalho paralelo sem sobrescrever arquivos de outro agente.
- As skills abaixo foram geradas pelo `iniciar.mjs` oficial, lidas pelos agentes e preservadas em `skills/`. São instruções versionadas do projeto, sem instalação de extensões pessoais.

## Agente 1 — Backend, Cloudflare D1 e Discord OAuth2

- Sessão de execução: `/root/backend`.
- Skill: [`skills/serverless-d1-discord/SKILL.md`](skills/serverless-d1-discord/SKILL.md).
- Responsabilidade: migrar o exemplo inicial para autenticação real, sessão assinada em cookie HttpOnly, proteção CSRF, permissões derivadas da sessão, banco relacional e rotas de leitura e edição de currículos.
- Arquivos sob sua responsabilidade: `functions/` e `migrations/`.
- Critério de aceite: rascunhos privados, dados persistidos por usuário, rejeição de payloads inválidos e ausência de segredos no cliente.

## Agente 2 — Interface em HTML5, CSS3 e JavaScript puro

- Sessão de execução: `/root/frontend`.
- Skill: [`skills/vanilla-dom-ui/SKILL.md`](skills/vanilla-dom-ui/SKILL.md).
- Responsabilidade: formulários estruturados, prévia em tempo real, temas moderno/clássico/minimalista, publicação explícita, compartilhamento, impressão em PDF e interface responsiva e acessível.
- Arquivos sob sua responsabilidade: `public/`.
- Critério de aceite: nenhum framework de interface, DOM seguro, feedback coerente com respostas reais da API e chave no rodapé.

## Agente 3 — Teste e validação independente

- Sessão de execução: `/root/qa`.
- Skill: [`skills/teste-validacao/SKILL.md`](skills/teste-validacao/SKILL.md).
- Responsabilidade: testes de integração das rotas com SQLite real em memória, OAuth com serviço externo controlado, validação de sessões, isolamento entre usuários, CSRF, publicação/privacidade e conformidade estrutural.
- Arquivos sob sua responsabilidade: `tests/` e [`docs/VALIDACAO.md`](docs/VALIDACAO.md).
- Critério de aceite: executar os testes e registrar resultados observados, bugs encontrados e limitações, distinguindo testes locais de autenticação e banco em produção.

## Evidências e limites

A execução dos agentes foi coordenada pelo harness com mensagens de progresso e revisão cruzada do contrato. Os testes reproduzíveis estão em `tests/`; o resultado efetivo e as verificações que dependem de contas externas estão em [`docs/VALIDACAO.md`](docs/VALIDACAO.md). A validação estrutural do professor não substitui o teste real de Discord e D1 em produção. Etapas não verificadas devem permanecer identificadas como pendentes.
