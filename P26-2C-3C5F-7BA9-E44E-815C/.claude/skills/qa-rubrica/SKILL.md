---
name: qa-rubrica
description: Checklist de validação do projeto contra a rubrica de correção (deploy, D1 + OAuth, vanilla JS, agentes, GitHub).
---
- [ ] Publicado no Cloudflare Pages e acessível por HTTPS; todas as funções do projeto funcionam.
- [ ] Login apenas por Discord (user_id, nome, avatar); regras validadas nas Functions.
- [ ] Dados persistidos no D1 (receitas, ingredientes com quantidade e unidade separadas, passos, favoritos).
- [ ] Busca por nome, tempo e ingrediente; escalonador recalcula o DOM em tempo real; favoritos por usuário.
- [ ] Interface só com HTML, CSS e JS puro, responsiva, sem `innerHTML` com dados de usuário.
- [ ] `docs/AGENTES.md` com 3 agentes ou mais (um de teste), harness e skills em `.claude/skills/`.
- [ ] Repositório público, `LICENSE` MIT, chave P26-2C-3C5F-7BA9-E44E-815C no README e no rodapé.
- [ ] URLs do projeto e do repositório entregues no AVA.
