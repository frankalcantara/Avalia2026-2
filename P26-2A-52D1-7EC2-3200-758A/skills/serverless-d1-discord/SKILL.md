---
name: serverless-d1-discord
description: Use ao criar ou alterar rotas em functions/, o esquema em migrations/ ou o login Discord do Catálogo de Filmes (P26-2A-52D1-7EC2-3200-758A). Define como validar no servidor, modelar o D1 e manter sessões seguras.
---

# Skill: Arquiteto Serverless (Cloudflare Pages Functions + D1 + Discord OAuth2)

## Contexto do projeto
Catálogo de filmes e séries em que cada pessoa logada pelo Discord dá **uma** nota de 1 a 5 por obra (editável) e uma resenha curta.
A galeria mostra média aritmética e total de avaliações, ordenável por nota média, popularidade ou lançamentos recentes.

## Regras obrigatórias

1. **O servidor decide tudo.** Toda validação (login, nota, tamanho da resenha, tipo, ano, duplicados) roda nas Functions.
   O que o navegador valida é só conforto para o usuário: nunca a única barreira.
2. **Identidade só pela sessão.** O `user_id` de quem age vem de `usuarioAtual(env, request)`, que busca a sessão no D1.
   Nunca ler `user_id` do corpo, da URL ou de um cookie com dados do usuário.
3. **Sessões no D1, cookie só com token.** Token aleatório de 32 bytes (`crypto.getRandomValues`), cookie
   `HttpOnly; Secure; SameSite=Lax`, expiração de 7 dias, sessões vencidas apagadas na criação de novas.
4. **OAuth2 com `state`.** Gerar `state` aleatório em cookie temporário (10 min) e recusar o callback se não bater.
   Escopo mínimo: `identify`. Importar `user_id`, nome (`global_name` ou `username`) e avatar.
5. **SQL sempre parametrizado.** `env.DB.prepare("... ?").bind(...)`. Valores dinâmicos de `ORDER BY` só de uma lista
   fixa no código (`ORDENS`), nunca concatenando texto do usuário. Em `LIKE`, escapar `%`, `_` e `\`.
6. **Regras também no banco.** A tabela `avaliacoes` tem `PRIMARY KEY (user_id, filme_id)` e `CHECK (nota BETWEEN 1 AND 5)`.
   A gravação usa `INSERT ... ON CONFLICT(user_id, filme_id) DO UPDATE`, então a segunda nota vira edição.
7. **Agregação no servidor.** Média com `ROUND(AVG(nota), 2)` e total com `COUNT(nota)`, via `LEFT JOIN` para títulos sem nota.
8. **Respostas padronizadas.** `json()` / `erro()` de `lib/servidor.js`, com códigos HTTP corretos:
   `400` dado inválido · `401` sem login · `404` não encontrado · `409` duplicado · `201` criado · `200` editado.

## Contrato da API

| Método | Rota | Login | Descrição |
| :--- | :--- | :---: | :--- |
| GET | `/api/auth/discord` | – | Inicia o OAuth2 |
| GET | `/api/auth/discord/callback` | – | Conclui o OAuth2 e cria a sessão |
| POST | `/api/auth/logout` | – | Encerra a sessão |
| GET | `/api/me` | – | Usuário logado ou `null` |
| GET | `/api/titulos?ordem=media\|popularidade\|recentes&tipo=&busca=` | – | Galeria com `media`, `total`, `minha_nota` |
| POST | `/api/titulos` | ✔ | Cadastra título `{nome, tipo, ano_lancamento, genero?}` |
| GET | `/api/titulos/:id` | – | Detalhes, distribuição das notas e resenhas |
| PUT | `/api/titulos/:id/avaliacao` | ✔ | Cria ou edita `{nota, resenha}` |
| DELETE | `/api/titulos/:id/avaliacao` | ✔ | Remove a própria avaliação |
| GET | `/api/status` | – | Diagnóstico (D1 e Discord) |

## Checklist antes de entregar ao Agente 2
- [ ] Toda rota que grava chama `usuarioAtual` e responde 401 sem sessão.
- [ ] Nenhuma query concatena texto vindo do usuário.
- [ ] Migração aplicada localmente (`wrangler d1 migrations apply DB --local`) sem erro.
