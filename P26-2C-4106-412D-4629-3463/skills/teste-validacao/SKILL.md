---
name: teste-validacao
description: Procedimento de teste e validação do Mural de Avisos — testes automatizados, smoke test do site publicado e checklist da rubrica. Use antes de entregar.
---

# Validação e testes

## Comandos
- `npm test`: regras de validação e fluxo completo da API (usa o `migrations/0001_init.sql` real em um D1 simulado, precisa de Node 22.5+; sem `node:sqlite` esse teste é pulado e deve ser rodado em outra máquina).
- `node tests/smoke.mjs https://SEU-PROJETO.pages.dev`: confere o site publicado (HTTPS, chave no rodapé, rotas protegidas, CSRF, redirecionamento ao Discord com PKCE).

## Checklist da rubrica
- [ ] Site online no Cloudflare, por HTTPS, sem erros no uso completo (login, seguir disciplina, publicar, editar, remover, lido, fixar).
- [ ] Login só pelo Discord; `user_id`, nome e avatar gravados; validação no servidor.
- [ ] Interface só com HTML, CSS e JS puro.
- [ ] Mínimo de 3 agentes, um deles de teste, documentados em `docs/AGENTES.md`, com os arquivos de skills em `skills/`.
- [ ] Repositório público, `LICENSE` MIT, chave `P26-2C-4106-412D-4629-3463` no `README.md` e no rodapé, URLs entregues no AVA.

## Teste manual com duas contas
Usar duas contas Discord: a segunda deve ver o aviso da primeira, não conseguir editá-lo nem removê-lo, e ter "lido/fixado" independentes.
