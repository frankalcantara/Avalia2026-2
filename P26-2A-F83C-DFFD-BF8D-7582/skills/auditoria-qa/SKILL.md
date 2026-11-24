---
name: auditoria-qa
description: Protocolo do Agente de Teste e Validação do Projeto #14. Use para auditar segurança de sessão, contratos JSON, integridade no D1, testes automatizados, validação estrutural da rubrica e QA visual antes de deploy ou Pull Request.
---

# Skill: Auditoria, Testes e Validação

**Papel:** auditor independente — não implementa features; encontra falhas, prova com testes e bloqueia entrega insegura.

## Quando ativar

- Antes de qualquer commit, deploy ou Pull Request.
- Após alterar `functions/`, `lib/session.js`, `public/`, schema ou testes.
- Ao revisar requisitos da rubrica (licença, agentes, skills, chave, URL).
- Ao investigar comportamento estranho em produção.

## 1. Suíte automatizada

```bash
node --test tests/api.test.mjs
```

Gate: **6/6 testes verdes, 0 falhas**.

| Teste | Risco coberto |
|-------|---------------|
| `signSession e verifySession rejeitam token adulterado` | payload forjado, assinatura inválida, segredo errado |
| `GET/POST /api/logs retornam 401 sem sessão válida` | rota protegida acessível anonimamente |
| `POST /api/logs valida payload e força timestamp UTC do servidor` | `criado_em` do cliente aceito, campos inválidos |
| `GET /api/logs isola por user_id e filtra busca/intervalo` | vazamento entre usuários, filtro de fim não inclusivo |
| `GET /api/auth/me valida sessão e limpa cookie no logout` | sessão expirada aceita, logout sem `Max-Age=0` |
| `aliases oficiais /api/auth/discord ...` | rotas oficiais quebradas ou query perdida |

Se um teste falhar: reproduzir, corrigir a causa raiz e rodar de novo. Nunca ajustar o teste para mascarar bug.

## 2. Matriz de contrato da API

| Requisição | Esperado |
|------------|----------|
| `GET /api/logs` sem cookie | `401 {"error":"Não autenticado"}` |
| `GET /api/logs` com cookie adulterado | `401` |
| `GET /api/logs` com sessão | `200` + somente registros do usuário |
| `GET /api/logs?inicio=2026-13-99` | `400` |
| `GET /api/logs?impedimento=x` | `400` |
| `POST /api/logs` sem sessão | `401` |
| `POST /api/logs` JSON inválido | `400` |
| `POST /api/logs` sem `conteudo`/`impedimento` | `400` |
| `POST /api/logs` com 2001 caracteres | `400` |
| `POST /api/logs` com `impedimento:"ok"` | `400` |
| `POST /api/logs` válido | `201 {success:true,id,criado_em}` |
| `POST` com `criado_em:"1999-01-01"` | ignora e grava UTC atual |
| `GET /api/auth/me` sem sessão | `401 {"error":"Não autenticado"}` |
| `GET /api/auth/me` com sessão | `200 {user_id,username,avatar}` |
| `GET /api/auth/me?logout=1` | `200 {success:true}` + `Set-Cookie` com `Max-Age=0` |
| `GET /api/auth/discord` | `302 /api/auth/login` |
| `GET /api/auth/discord/callback?code=a&state=b` | `302 /api/auth/callback?code=a&state=b` |
| `GET /api/auth/login` | `302 discord.com/oauth2/authorize` com `state` e `scope=identify` |

## 3. Auditoria de segurança

- [ ] Nenhum segredo em `public/`, README, testes ou Git (`DISCORD_CLIENT_SECRET`, `SESSION_SECRET`).
- [ ] Cookie `session`: `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` em HTTPS.
- [ ] HMAC verificado com `crypto.subtle.verify`; payload Base64URL decodificado só após validação.
- [ ] `exp` rejeitado quando expirado; `user_id` obrigatório.
- [ ] `state` OAuth2 aleatório, comparado e cookie limpo após uso.
- [ ] `code` do Discord nunca é reutilizado nem exposto.
- [ ] Queries 100% parametrizadas (`bind`), sem interpolação.
- [ ] `user_id` sempre da sessão, nunca de query/body.
- [ ] `criado_em` sempre `new Date().toISOString()` no servidor.
- [ ] Erros `500` genéricos; detalhes apenas em `console.error`.
- [ ] Nenhum `innerHTML` com dado da API no frontend.
- [ ] Nenhuma dependência de UI/framework no projeto.

## 4. Integridade no D1

- [ ] `migrations/0001_init.sql` e `schema.sql` idênticos em estrutura.
- [ ] Tabela `logs` com 7 colunas e `id` AUTOINCREMENT.
- [ ] Índice `idx_logs_user_criado (user_id, criado_em DESC)` presente.
- [ ] `conteudo` e `impedimento` com `NOT NULL`.
- [ ] `SELECT` explícito das colunas (sem `SELECT *`).
- [ ] `GET` ordena por `criado_em DESC, id DESC`.
- [ ] `fim` usa `T23:59:59.999Z` e inclui o dia inteiro.

## 5. Conformidade estrutural (rubrica)

```bash
node validar-local.mjs P26-2A-F83C-DFFD-BF8D-7582
```

Esperado: **9/9 checks**, incluindo deploy online.

| Item | Verificação |
|------|-------------|
| LICENSE | MIT presente |
| README | contém `P26-2A-F83C-DFFD-BF8D-7582` e URL `*.pages.dev` |
| AGENTS | `AGENTS.md` com ≥3 agentes, incluindo teste/validação |
| Skills | `skills/*/SKILL.md` (atualmente 4) |
| Frontend | HTML presente, sem frameworks proibidos |
| Backend | `functions/` + D1 (`schema.sql`/`migrations/`) + Discord OAuth2 |
| Rodapé | `<footer>` contém a Chave Única |
| Deploy | home online com a chave no HTML |
| Isolamento | só arquivos dentro de `P26-2A-F83C-DFFD-BF8D-7582/` |

Comando auxiliar para inspecionar todos os checks:

```bash
node --input-type=module -e "process.argv[1]='runner.mjs'; const { inspecionarSubpasta } = await import('./validar-local.mjs'); const { checks } = await inspecionarSubpasta('P26-2A-F83C-DFFD-BF8D-7582','P26-2A-F83C-DFFD-BF8D-7582',{checkLiveUrl:true}); console.log(JSON.stringify(checks,null,2));"
```

## 6. QA manual — fluxo OAuth2 ponta a ponta

1. Abrir `https://avalia2026-2-a7z.pages.dev` em janela anônima.
2. Clicar em "Entrar com Discord" → autorizar `identify`.
3. Confirmar retorno para `/`, avatar/username no header e formulário visível.
4. `GET /api/auth/me` → `200` com o mesmo `user_id`.
5. Registrar atividade → `201`; conferir horário UTC atual (não o do cliente).
6. Recarregar → registro permanece e aparece no topo da timeline.
7. Filtrar por palavra-chave, impedimento e intervalo → resultados coerentes.
8. Clicar em "Sair" → volta ao estado deslogado e `/api/auth/me` → `401`.
9. Repetir login → nova sessão funciona.

## 7. QA visual e de acessibilidade

- [ ] 360px, 768px e 1280px sem overflow horizontal.
- [ ] Light e dark mode legíveis; rodapé escuro com chave visível.
- [ ] Foco de teclado visível em login, textarea, select, datas, botões e links.
- [ ] Timeline alinhada; dot centrado no eixo em desktop e mobile.
- [ ] Badge de impedimento tem texto + cor (não só cor).
- [ ] Estados: loading, vazio sem filtro, vazio com filtro e erro.
- [ ] Botão "Registrando..." desabilita durante envio.
- [ ] `prefers-reduced-motion` desliga animações.
- [ ] Contraste AA nos textos e controles.
- [ ] Console sem erros; nenhum 404 de CSS/JS.

## 8. Evidência e relatório

Registrar no PR ou no `AGENTS.md`:

```text
Comando: node --test tests/api.test.mjs
Resultado: 6/6 pass, 0 fail

Comando: node validar-local.mjs P26-2A-F83C-DFFD-BF8D-7582
Resultado: 9/9 checks

Deploy: https://avalia2026-2-a7z.pages.dev
Home: 200 | CSS: 200 | /api/auth/me: 401 | /api/logs: 401
```

Tabela de auditoria:

| Critério | Status | Evidência |
|----------|--------|-----------|
| Sessão HMAC + expiração | ✅/❌ | teste/rota |
| `state` anti-CSRF | ✅/❌ | código |
| UTC server-side | ✅/❌ | teste |
| Isolamento por usuário | ✅/❌ | teste |
| Validação de payload | ✅/❌ | teste |
| Sem frameworks | ✅/❌ | grep/validator |
| Chave no rodapé/README | ✅/❌ | validator |
| Deploy online | ✅/❌ | HTTP |

## 9. Anti-patterns de auditoria

- ❌ Declarar "pronto" sem rodar os testes.
- ❌ Testar só o caminho feliz.
- ❌ Aceitar `200` com `{error}` como sucesso.
- ❌ Ignorar cookie expirado/adulterado.
- ❌ Validar só no frontend.
- ❌ Abrir PR com alterações fora da pasta da chave.
- ❌ Considerar a chave `F26` validada pela API oficial (formato aceito: `P26`/`T26`); registrar a pendência, não maquiar.

