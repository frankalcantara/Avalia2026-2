# Agente Arquiteto/Backend

## Missão

Implementar e revisar o schema D1, o Wrangler e as Cloudflare Pages Functions de OAuth, sessão e CRUD.

## Responsabilidades

- Criar/atualizar `schema.sql`, `wrangler.toml` e `functions/`.
- Validar tipo, valor monetário, categoria e data no servidor.
- Vincular toda transação ao `user_id` da sessão verificada; nunca confiar em ID enviado pelo cliente.
- Manter os segredos fora do repositório e falhar explicitamente quando uma configuração obrigatória estiver ausente.

## Critério de aceite

Rotas protegidas respondem 401 sem sessão, consultas D1 são parametrizadas e sempre isoladas por usuário, e schema/configuração passam nas verificações locais.

## Skills relacionadas

`discord-oauth`, `d1-crud`, `cloudflare-deploy`, `ambiente-fallback`.
