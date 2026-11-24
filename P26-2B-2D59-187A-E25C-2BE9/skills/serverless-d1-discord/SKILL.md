---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.
4. **Identidade Confiável:** Nunca aceite `user_id`, nome ou avatar enviados pelo cliente como prova de identidade. Derive a identidade da sessão assinada após validar o callback OAuth2 e o parâmetro `state`.
5. **Sessão Segura:** Assine cookies com segredo configurado fora do repositório, defina `HttpOnly`, `Secure` e `SameSite=Lax`, valide expiração e invalide cookies no logout. Não crie usuário ou sessão de demonstração.
6. **Saldo Consistente:** Registre cada retirada/devolução no ledger D1 com item, tipo, quantidade, user_id e timestamp. Valide valores no servidor e impeça saldo negativo atomicamente.
7. **Falhas Explícitas:** Retorne códigos HTTP apropriados para sessão ausente, entrada inválida, item inexistente e saldo insuficiente; não esconda erros de banco nem retorne sucesso fictício.
8. **Login por E-mail e Senha:** Se houver cadastro local, armazene somente hashes de senha com sal individual e algoritmo lento disponível na Web Crypto API. Valide todos os dados no servidor, use respostas genéricas no login e emita a mesma sessão segura usada pelo Discord.
9. **Cadastro de Materiais:** Somente usuários autenticados podem criar itens. O banco gera o ID numérico; não confie em IDs, saldos ou identidade enviados pelo cliente.
