---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.

## Especificações do Projeto #37 (Almoxarifado de Hardware)
- **Banco de Dados (`migrations/`):** Criar tabelas no Cloudflare D1 para `itens` (id, nome, categoria, quantidade_atual, limite_minimo) e `transacoes` (id, id_item, tipo_movimento, quantidade_movimentada, user_id, timestamp).
- **Endpoints (`functions/api/`):** Rotas para autenticar via Discord OAuth2 (capturando `user_id`, `username` e `avatar`), listar inventário, registrar retiradas/devoluções e listar itens em "Estoque Crítico".
- **Validação:** Bloquear no backend qualquer tentativa de retirada maior que o saldo disponível na bancada.