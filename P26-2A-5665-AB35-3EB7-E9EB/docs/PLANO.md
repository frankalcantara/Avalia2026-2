# Plano do trabalho

Projeto #36 — implementar e publicar uma aplicação de reservas diárias para salas de reunião, cabines de estudo e bancadas de laboratório. Chave: `P26-2A-5665-AB35-3EB7-E9EB`.

## Lista de requisitos

- [x] Interface responsiva em HTML, CSS e JavaScript sem framework.
- [x] Agenda diária agrupada por espaço, navegação de datas e estados visuais de livre, minha reserva e reserva de terceiros.
- [x] Autenticação OAuth2 Discord com escopo `identify`, estado validado, sessão assinada e perfil persistido no D1.
- [x] Worker serverless e migração D1 para usuários, espaços e reservas.
- [x] Regras de negócio no backend: data/hora futura, bloqueio de sobreposição e limite diário de 120 minutos.
- [x] Cancelamento da reserva pelo titular antes do início.
- [x] Licença MIT, hash no README e rodapé, harness e skills documentados.
- [x] Configurar credenciais OAuth2 do Discord na conta Cloudflare e publicar a aplicação.
- [x] Organizar a entrega na pasta da chave oficial e abrir o Pull Request para avaliação.

## Rubrica e evidências

| Critério | Peso | Evidência |
| --- | ---: | --- |
| Aplicação pública em Cloudflare | 25 | Worker e URL HTTPS |
| Serverless, D1, OAuth2 Discord e regras de negócio | 25 | `src/index.js`, `migrations/0002_reservation_scheduler.sql` |
| HTML, CSS e JavaScript | 15 | `public/` |
| Agentes, harness e skills; mínimo de três papéis, incluindo validação | 25 | `docs/agents/` e `skills/` |
| Repositório público, MIT, hash e submissão | 10 | GitHub, `LICENSE`, hash e Pull Request oficial aberto para avaliação |

## Verificações

- O Worker valida autenticação em `/api/me` e escrita de reservas; disponibilidade é somente leitura e pública.
- Uma instrução SQL condicional revalida conflitos e limite diário no momento da inserção.
- Testes de sintaxe, migração e publicação serão registrados em `docs/VALIDACAO_REMOTA.md` após esta versão.

## Repositório

[github.com/luiz964/dia-claro-cloudflare-tasks](https://github.com/luiz964/dia-claro-cloudflare-tasks)
