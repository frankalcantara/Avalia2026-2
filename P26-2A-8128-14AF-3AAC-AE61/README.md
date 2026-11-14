# EntreLivros — Projeto 24

Plataforma de empréstimo e troca de livros físicos entre estudantes.

- **Estudante:** Rennan Raposo
- **Turma:** 2A
- **Chave Única:** `P26-2A-8128-14AF-3AAC-AE61`
- **URL_CLOUDFLARE:** https://entrelivros-rennan.pages.dev
- **Repositório público:** https://github.com/rennanraposo/Avalia2026-2/tree/projeto-24/P26-2A-8128-14AF-3AAC-AE61
- **Pull Request oficial:** https://github.com/frankalcantara/Avalia2026-2/pull/37
- **Licença:** MIT, disponível em [LICENSE](LICENSE).

## Funcionalidades

- Catálogo público com busca por título/autor e filtros de categoria, modalidade e disponibilidade.
- Login exclusivamente pelo Discord OAuth2: importa `user_id`, handle, nome visível e avatar.
- Cadastro, edição e remoção de exemplares próprios, técnicos ou literários.
- Pedidos de empréstimo e troca, com contato pelo handle Discord para entrega presencial.
- Disponível → Reservado ao solicitar; Reservado → Emprestado ao aprovar empréstimo com data prevista de devolução; devolução libera o exemplar.
- Aprovação/recusa pelo proprietário, cancelamento de pedidos pendentes pelo solicitante e histórico no painel.
- Troca com oferta de outro exemplar: reserva os dois, registra aprovação e transfere a propriedade de ambos quando o dono confirma a entrega.
- Banco D1 registra os participantes, os estados e o prazo de devolução. Datas seguem o calendário de São Paulo.

## Arquitetura e segurança

Cliente HTML5/CSS3/JavaScript puro em `public/`, com manipulação direta do DOM. Nenhum framework de interface nem dependência de runtime no navegador. Regras de negócio ficam nas Cloudflare Pages Functions (`functions/`) e módulos `lib/`; dados relacionais em Cloudflare D1 (`migrations/`). As dependências npm são ferramentas locais de desenvolvimento e testes.

O servidor não aceita o proprietário ou o usuário enviados pelo cliente. Sessões são identificadores aleatórios de 256 bits em cookies HttpOnly, com hash armazenado no D1, expiração e revogação. OAuth usa `state` de uso único. Escritas verificam origem, sessão e autorização, além de JSON, limites e enums. SQL parametrizado e triggers transacionais impedem duas reservas simultâneas do mesmo exemplar. O histórico é preservado pela remoção lógica dos livros. Não há senha local, login de demonstração ou criação de sessão acessível em produção.

## Executar localmente

Requisitos: Node.js 22.18+ e Git. No laboratório, siga o ambiente Node.js via Scoop exigido pelo professor; os comandos `.cmd` evitam o bloqueio de scripts PowerShell.

```powershell
cd P26-2A-8128-14AF-3AAC-AE61
npm.cmd ci
Copy-Item .dev.vars.example .dev.vars
# Preencha .dev.vars localmente com as credenciais Discord.
npm.cmd run db:local
npm.cmd run dev
```

Não sobrescreva `.dev.vars` se ele já estiver preenchido. Abra `http://127.0.0.1:8788`. O catálogo inicia vazio, sem dados inventados. Para login local, cadastre o redirect `http://127.0.0.1:8788/api/auth/discord/callback` no Discord. [Passo a passo do Discord](docs/CONFIGURAR-DISCORD.md).

## Validar

```powershell
npm.cmd test
npm.cmd run build:check
cd ..
node validar-local.mjs P26-2A-8128-14AF-3AAC-AE61
```

A suíte usa o runtime Cloudflare local e D1 isolado. Os perfis fictícios são exclusivos dos testes. Ela não substitui a autorização real pelo Discord nem o ensaio entre duas pessoas no site publicado. Consulte [VALIDACAO.md](docs/VALIDACAO.md) para os resultados efetivos e limites.

## Publicação na Cloudflare Pages

Projeto publicado: `entrelivros-rennan`, vinculado ao fork público do repositório oficial.

| Configuração | Valor |
|---|---|
| Branch de produção | `projeto-24` |
| Diretório raiz | `P26-2A-8128-14AF-3AAC-AE61` |
| Comando de build | em branco |
| Diretório de saída | `public` |
| Binding D1 | `DB` |
| Banco | `db-p26-2a-8128-14af-3aac-ae61` |

O identificador do banco em `wrangler.jsonc` não é uma senha. A aplicação não deve ser entregue com um UUID fictício. Aplique as migrações remotas somente no banco desta aplicação:

```powershell
npm.cmd run db:remote
```

Cadastre `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` como secrets no Pages, fora do Git, e adicione no Discord o redirect da URL definitiva seguido de `/api/auth/discord/callback`. Depois republique e confira `/api/status`, o login e os fluxos de empréstimo/troca.

## Entrega e documentação

- [Checklist dos 100 pontos e etapas externas](docs/CHECKLIST-ENTREGA.md).
- [Agentes, harness e skills](AGENTS.md): três agentes efetivamente criados, um dedicado a teste e validação.
- [Contrato da API](docs/CONTRATO-API.md), [banco e segurança](docs/BACKEND.md), [design](docs/DESIGN.md).
- [Roteiro de demonstração](docs/ROTEIRO-DEMONSTRACAO.md).
- [Repositório oficial do professor](https://github.com/frankalcantara/Avalia2026-2).

O Projeto 0 é uma etapa prévia separada, sem nota. O fork já contém a pasta de teste `T26-2A-2FDD-6CD3-97B0-E36E`, cuja publicação foi corrigida e validada em 13/11/2026 com login real e gravação persistente no D1. Não incluir pastas T26 no Pull Request oficial, pois são rejeitadas pelo fluxo do professor. Após concluir as verificações, abrir PR contendo apenas esta pasta P26 e entregar no AVA as URLs do site e do repositório. A entrega no AVA deve ser feita pelo estudante.
