# Engenharia de agentes

Este projeto foi organizado com três papéis de agentes distintos. A documentação descreve a divisão de responsabilidades e os harnesses previstos para execução/revisão; os agentes não são serviços autônomos implantados dentro do site.

## Agente 1 — Interface e experiência (Frontend)
- **Responsabilidade:** construir páginas HTML, estilos responsivos e comportamento DOM em JavaScript puro.
- **Harness:** ambiente de desenvolvimento de código (editor/terminal com acesso ao repositório).
- **Skill utilizada:** `agents/skills/frontend/SKILL.md`.
- **Entregas:** `index.html`, `post.html`, `author.html`, `styles.css`, `app.js`, `post.js`, `author.js`.

## Agente 2 — API, autenticação e dados (Backend)
- **Responsabilidade:** implementar OAuth2 Discord, sessão, endpoints Pages Functions, schema D1 e autorização por propriedade.
- **Harness:** ambiente de desenvolvimento serverless compatível com Cloudflare Pages Functions e Wrangler.
- **Skill utilizada:** `agents/skills/backend/SKILL.md`.
- **Entregas:** `functions/` e `schema.sql`.

## Agente 3 — Testes e validação (QA)
- **Responsabilidade:** verificar requisitos, rotas, persistência, autorização, regressões e instruções de publicação.
- **Harness:** Node.js Test Runner (`node:test`) e execução local com Wrangler; validação final manual no ambiente publicado.
- **Skill utilizada:** `agents/skills/qa/SKILL.md`.
- **Entregas:** `tests/project.test.js` e checklist abaixo.

## Checklist de validação
- [ ] Página inicial acessível sem login.
- [ ] Login Discord importa ID, nome e avatar.
- [ ] Usuário autenticado cria artigo.
- [ ] Usuário não autor não consegue editar nem excluir artigo alheio.
- [ ] Comentários exibidos em ordem cronológica com perfil Discord.
- [ ] Curtidas persistidas e alternáveis.
- [ ] Páginas de autor e artigo funcionam.
- [ ] Segredos armazenados nas variáveis do ambiente, nunca no Git.
- [ ] Deploy HTTPS no Cloudflare testado.
- [ ] Repositório público, licença MIT e chave no README/rodapé.

## Limites da validação
Os testes automatizados do repositório são testes estruturais e de regras verificáveis por código. A autenticação real, as permissões do Discord, o binding D1 e o deploy precisam ser testados com credenciais e infraestrutura do proprietário.
