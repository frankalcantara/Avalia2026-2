---
name: serverless-d1-discord
description: Padrões para autenticação Discord OAuth2, sessões assinadas e API segura em Cloudflare Pages Functions com D1.
---

# Cloudflare Pages Functions + D1 + Discord OAuth2

- Troque o código OAuth2 no servidor, valide `state` e solicite apenas o escopo `identify`.
- Assine a sessão com segredo mantido em variável de ambiente; use cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Derive user ID, nome e avatar do perfil obtido diretamente do Discord. Nunca aceite identidade/autor do corpo enviado pelo navegador.
- Aplique autenticação e autorização em cada endpoint e confira propriedade antes de editar ou excluir avisos.
- Valide tamanhos, formatos, métodos HTTP e parâmetros; retorne erros HTTP explícitos.
- Use sempre parâmetros vinculados nas queries D1.
- Mantenha inscrições e estados lido/fixado separados por usuário.
