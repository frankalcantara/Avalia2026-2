# Projeto #40 — Timesheet e apontamento de horas

Ferramenta para registrar horas de engenharia de software por etapa do ciclo de vida. O cronômetro e os lançamentos manuais usam autenticação Discord; os registros e as estimativas são persistidos no Cloudflare D1.

- **Chave Única:** `P26-2A-72B9-56ED-0328-0872`
- **URL_CLOUDFLARE:** https://painel-tarefas-cloudflare.painel-tarefas-cloudflare.workers.dev
- **Repositório do projeto:** https://github.com/luiz964/Avalia2026-2/tree/entrega-p26-2a-72b9-56ed-0328-0872/P26-2A-72B9-56ED-0328-0872
- **Entrega oficial:** https://github.com/luiz964/Avalia2026-2/tree/main/P26-2A-72B9-56ED-0328-0872

## Funcionalidades

- Cronômetro para acompanhar o tempo de uma tarefa em tempo real.
- Apontamento manual com horário de início e fim.
- Classificação em Requisitos, Arquitetura, Codificação e Testes.
- Painel com totais individuais e da equipe para o dia selecionado.
- Estimativa ajustável por etapa e comparação acumulada entre horas estimadas e realizadas.
- Login OAuth2 via Discord e persistência no D1.

## Desenvolvimento local

1. Instale as dependências com `npm install`.
2. Aplique as migrações locais com `npm run db:migrate:local`.
3. Configure os secrets de Discord com Wrangler e rode `npm run dev`.
4. Rode `npm test` para validar os fluxos com Worker e D1 locais.

## Publicação

O projeto usa Cloudflare Workers Assets e o banco D1 `painel-tarefas-db`. Para publicar, aplique `npm run db:migrate:remote` e `npm run deploy`. O Client Secret do Discord deve permanecer configurado como secret no Cloudflare e nunca ser commitado.

## Licença

MIT. Consulte `LICENSE`.

