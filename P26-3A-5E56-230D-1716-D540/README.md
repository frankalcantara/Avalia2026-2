# Projeto #34: Vitrine de Achados e Perdidos do Campus

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Alexandre Vieira
- **Turma:** 3A
- **Chave Única:** `P26-3A-5E56-230D-1716-D540`
- **URL_CLOUDFLARE:** https://achados-perdidos-campus.pages.dev
- **Repositório:** https://github.com/alexrodrigues7180-cell/Avalia2026-2/tree/main/P26-3A-5E56-230D-1716-D540
- **Licença:** MIT ([LICENSE](./LICENSE))

---

## Especificação do Projeto

Catálogo centralizado para reportar objetos esquecidos ou encontrados nas dependências da universidade.
Estudantes autenticados pelo Discord podem cadastrar um item informando categoria (eletrônicos,
documentos, garrafas, vestuário), local exato, data e descrição detalhada.

Os registros no Cloudflare D1 operam sob dois tipos: "Perdi" e "Encontrei". A interface em JavaScript
puro oferece filtros cruzados rápidos e permite que um usuário abra uma reivindicação sobre um item
listado, registrando o contato do Discord de ambas as partes no banco para que façam a devolução e
marquem o caso como encerrado.

## O que o sistema faz

- **Login exclusivo com Discord (OAuth2)**: importa `user_id`, nome de usuário e avatar; sessão segura
  (token aleatório, só o hash no banco, cookie `HttpOnly`/`Secure`/`SameSite`), proteção com `state`.
- **Vitrine pública** com **filtros cruzados**: Perdi/Encontrei × categoria × situação × busca × local ×
  intervalo de datas × ordenação, com contadores e filtros guardados na URL (dá para compartilhar).
- **Cadastro de item** (logado), validado no servidor: tipo, categoria, título, descrição, local e data
  (não futura, até 1 ano atrás); limite de 10 cadastros por hora.
- **Reivindicação**: quem acha que o item é seu (ou que achou o item perdido) envia uma mensagem; o
  banco grava o contato Discord **das duas partes**, visível **só para elas**.
- **Fluxo de devolução**: o autor aceita ou recusa → item fica "em devolução" e os contatos aparecem →
  qualquer uma das partes marca como **devolvido/encerrado**. Cancelar a aceita reabre o item.
- **Painel "Reivindicações"**: recebidas e feitas, com as ações possíveis em cada uma.

Regras completas e contrato da API: [`docs/ESPECIFICACAO.md`](./docs/ESPECIFICACAO.md).

## Arquitetura

| Camada | Tecnologia | Onde |
|---|---|---|
| Interface | HTML5 + CSS3 + **JavaScript puro** (ES modules, sem framework) | [`public/`](./public/) |
| Regras de negócio | **Cloudflare Pages Functions** | [`functions/`](./functions/) |
| Banco | **Cloudflare D1** (SQLite) — `usuarios`, `sessoes`, `itens`, `reivindicacoes` | [`migrations/`](./migrations/) |
| Autenticação | **Discord OAuth2** (`scope=identify`) | [`functions/api/auth/`](./functions/api/auth/) |
| Segurança | CSP estrita, HSTS, CSRF por `Origin`, SQL parametrizado, sem `innerHTML` | [`public/_headers`](./public/_headers), [`docs/AUDITORIA-SEGURANCA.md`](./docs/AUDITORIA-SEGURANCA.md) |

## Agentes, harness e skills

Desenvolvido com **Claude Code** usando 6 agentes (orquestrador, back-end, front-end, auditor de
segurança, **teste e validação** e publicador Cloudflare). Detalhes em **[AGENTS.md](./AGENTS.md)**,
definições em [`.claude/agents/`](./.claude/agents/) e skills em [`skills/`](./skills/).

## Rodar localmente

Requer Node.js 20+.

```bash
npm install
cp .dev.vars.exemplo .dev.vars        # preencha DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET
npm run db:migrate:local
npm run dev                           # http://localhost:8788
```

Testes:

```bash
npm test          # unitários + estáticos
npm run test:api  # sobe o app com D1 local zerado, roda os testes de API e derruba
```

Validação da rubrica (na raiz do repositório): `node validar-local.mjs P26-3A-5E56-230D-1716-D540`

## Publicar no Cloudflare

Roteiro em [`skills/deploy-cloudflare-pages/SKILL.md`](./skills/deploy-cloudflare-pages/SKILL.md);
automatizado em [`scripts/publicar.sh`](./scripts/publicar.sh):

```bash
npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name achados-perdidos-campus   # 1ª vez
bash scripts/publicar.sh   # migrações D1 remotas + deploy + verificação
```

No Discord Developer Portal, o redirect cadastrado é
`https://achados-perdidos-campus.pages.dev/api/auth/discord/callback`.

---

Chave de auditoria: **P26-3A-5E56-230D-1716-D540**
