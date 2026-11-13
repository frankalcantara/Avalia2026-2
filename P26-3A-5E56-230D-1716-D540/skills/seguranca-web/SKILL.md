---
name: seguranca-web
description: Checklist de auditoria de segurança para app web em Cloudflare Pages + D1 com login Discord — OWASP Top 10 aplicado (controle de acesso, injeção, XSS, CSRF, sessão, cabeçalhos, segredos). Usar ao revisar functions/, public/, _headers e configuração antes de cada deploy.
---

# Skill: Auditoria de Segurança Web

Revise o código **lendo os arquivos**, não supondo. Para cada achado registre: arquivo:linha,
cenário concreto de ataque, gravidade (Alta/Média/Baixa) e correção. Corrija o que for Alta/Média.
Complementa `skills/cloudflare-oficial/workers-best-practices/SKILL.md` (anti-padrões de Workers).

## 1. Controle de acesso (OWASP A01) — o mais importante aqui
- Cada rota que altera estado confere **quem** é o usuário pela sessão do servidor (nunca por `user_id` vindo do corpo/URL).
- Autor ≠ reivindicante; só o autor aceita/recusa; só as partes veem `contato_*`.
- Ataques a testar: IDOR (trocar `:id`), reivindicar o próprio item, aceitar reivindicação de item alheio,
  encerrar item de outra pessoa, apagar item com reivindicação aceita, corrida (duas aceitações ao mesmo tempo
  → o `UPDATE ... WHERE status='pendente'` precisa garantir que só uma vence).

## 2. Injeção (A03)
- Todo SQL com `bind`. Procure `${` e `+` dentro de strings SQL. `ORDER BY` dinâmico só por lista branca.
- `LIKE`: escapar `%` e `_` do termo de busca (`ESCAPE '\'`).

## 3. XSS
- Procure `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`,
  `setAttribute('on…')`, `href` montado com dado do usuário (bloquear `javascript:`).
- Avatar só de `https://cdn.discordapp.com/`.

## 4. CSRF e sessão (A07)
- POST/DELETE exigem `Origin` == origem do site; corpo JSON exige `Content-Type: application/json`.
- Cookie de sessão `HttpOnly; Secure; SameSite=Lax`; token aleatório de 32 bytes; banco guarda só o hash;
  expira; logout apaga do banco.
- OAuth: `state` aleatório, conferido no callback, cookie de state apagado depois; `redirect_uri` fixo pela origem.
- Sessão **não** pode ser um JSON em base64 sem assinatura (dá para forjar qualquer usuário).

## 5. Cabeçalhos (A05) — `public/_headers` e middleware
```
Content-Security-Policy: default-src 'self'; img-src 'self' https://cdn.discordapp.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```
Respostas de `/api/*` também com `Cache-Control: no-store`.

## 6. Segredos e dados (A02/A04)
- `git grep -nE "client_secret|SECRET|token" -- . ':!*.md'`: nenhum valor real no repositório.
- `.dev.vars` no `.gitignore`.
- Mensagens de erro não expõem stack, SQL ou resposta do Discord.
- Entrada limitada em tamanho (corpo ≤ 8 KB; campos com máximo); limite de criação por usuário (429).

## 7. Verificação dinâmica (com o app rodando)
```
curl -sI <url>/ | grep -iE "content-security|strict-transport|x-content-type"
curl -s -X POST <url>/api/itens -H 'Content-Type: application/json' -d '{}'          # 401 ou 403
curl -s -X POST <url>/api/itens -H 'Origin: https://evil.example' ...                # 403
curl -s "<url>/api/itens?categoria=x'%20OR%201=1--"                                  # 400
```

## Saída
Relatório em `docs/AUDITORIA-SEGURANCA.md`: tabela de achados (antes/depois) e o que ficou de risco aceito.
