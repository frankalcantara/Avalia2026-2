---
name: claude-auditoria-deploy
description: Diagnóstico de falhas de deploy no Cloudflare Pages em repositórios com subpasta por estudante e auditoria do projeto contra a rubrica e contra falhas de segurança do backend serverless.
---

# Skill: Diagnóstico de Deploy e Auditoria de Conformidade

**Harness associado:** Claude (Claude Sonnet 5.5) — aplicativo web com ferramentas de arquivos, shell e busca na web
**Objetivo:** Interpretar logs de build do Cloudflare Pages, auditar o projeto contra a rubrica de 100 pontos e corrigir o que estiver em desacordo.

## 1. Diagnóstico de deploy
1. Ler o log de build e localizar as linhas-chave:
   - `Using v2 root directory strategy`
   - `No functions dir at /functions found` → o Pages está olhando a raiz do repositório, não a subpasta do projeto.
   - `Output directory "public" not found`
2. Conferir em **Settings → Builds** do projeto Pages:
   - **Root directory:** nome exato da subpasta `P26-...`
   - **Build command:** vazio
   - **Build output directory:** `public`
3. Conferir se `public/` está versionado (não ignorado pelo `.gitignore`) e presente no commit implantado.
4. Conferir o binding `DB` e as credenciais `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`; refazer o deploy.

## 2. Auditoria contra a rubrica
Para cada critério (deploy, arquitetura serverless + D1 + OAuth2, interface vanilla, agentes + skills, repositório/licença/chave) ler o código real e procurar contradições entre o que a documentação afirma e o que o código faz.
Pontos obrigatórios de revisão do backend:
- Sessão **assinada** (HMAC) — nunca cookie com JSON/base64 puro, que o cliente pode forjar.
- Parâmetro `state` no OAuth2 (proteção de CSRF de login).
- Login **exclusivo** via Discord: nenhuma rota de demonstração/bypass.
- Regra de negócio (teto por categoria) aplicada no servidor e de forma **atômica** (um único `INSERT ... SELECT ... WHERE`), sem *check-then-insert*.
- `user_id` sempre vindo da sessão, nunca do corpo da requisição; consultas D1 sempre com `bind()`.

## 3. Correção e verificação
Corrigir, cobrir cada falha com um teste automatizado (`node --test`) e só então atualizar README/AGENTS.md com o que foi de fato verificado.

## Prompt principal fornecido ao agente
> "Analise o README do repositório e os requisitos do Projeto #20 e corrija o erro de deploy do Cloudflare Pages (Output directory "public" not found). Depois verifique se o projeto está conforme os requisitos, edite os markdowns e faça qualquer alteração necessária."
