# Projeto #37 — Almoxarifado do laboratório

- **Chave Única:** `P26-2C-57E3-D257-CF08-28F5`
- **URL_CLOUDFLARE:** `https://bancada-p26-2c-57e3-d257-cf08-28f5.pages.dev` *(projeto Pages criado; deploy ainda em configuração.)*

Sistema de inventário para componentes eletrônicos, placas de desenvolvimento, sensores e ferramentas de laboratório. A interface é HTML5, CSS3 e JavaScript puro; autenticação, autorização e regras de estoque ficam nas Cloudflare Pages Functions com persistência no D1.

## Funcionalidades

- Login Discord OAuth2 (`identify`), com `user_id`, nome de usuário e avatar.
- Sessão HMAC em cookie `HttpOnly`, `Secure`, `SameSite=Lax`; fluxo OAuth protegido com `state` aleatório assinado.
- Consulta de inventário, atividade recente e aba de estoque crítico.
- Retirada/devolução validada no servidor; saldo e auditoria são gravados atomicamente no D1.
- Uma retirada superior ao saldo disponível retorna `409` sem alterar estoque nem criar transação.

## Estrutura oficial

- `public/`: interface em JavaScript puro.
- `functions/`: endpoints Cloudflare Pages Functions.
- `migrations/0001_init.sql`: schema D1, índices e itens demonstrativos.
- `skills/`: instruções de frontend, backend e validação.
- `AGENTS.md`: registro do harness e dos agentes de implementação/validação.
- `wrangler.jsonc`: configuração de Pages e binding `DB`.

## Configuração e deploy

1. O projeto Pages está conectado ao fork `marlonnanico/Avalia2026-2` com diretório raiz `P26-2C-57E3-D257-CF08-28F5`, sem comando de build e com diretório de saída `public`.
2. Neste projeto, o D1 `db-p26-2c-57e3-d257-cf08-28f5` já está criado, o binding `DB` está configurado e a migration inicial foi aplicada. Para instalar em outra conta Cloudflare, crie um D1 e atualize o `database_id` em `wrangler.jsonc`:

   ```powershell
   npx.cmd wrangler d1 create db-p26-2c-57e3-d257-cf08-28f5
   ```

   Copie o `database_id` retornado para `wrangler.jsonc`; o valor placeholder no arquivo não é uma credencial válida. Aplique a migration:

   ```powershell
   npx.cmd wrangler d1 migrations apply DB --remote
   ```

3. Crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications). Em OAuth2, registre o callback:
   `https://bancada-p26-2c-57e3-d257-cf08-28f5.pages.dev/api/auth/discord/callback`
4. Configure no Cloudflare Pages as variáveis `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET`, além do secret `SESSION_SECRET` (aleatório, com pelo menos 32 bytes). Nunca salve secrets no repositório.
5. Publique o projeto. A URL do Pages já está definida em `URL_CLOUDFLARE`; valide-a após o deploy.
6. Na raiz do fork, rode a validação oficial:

   ```powershell
   node validar-local.mjs P26-2C-57E3-D257-CF08-28F5
   ```

## Endpoints

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/auth/discord` | Inicia OAuth2 |
| GET | `/api/auth/discord/callback` | Valida OAuth2 e cria sessão |
| GET | `/api/auth/me` | Consulta usuário autenticado |
| POST | `/api/auth/logout` | Encerra sessão |
| GET | `/api/inventory` | Lista itens |
| GET | `/api/inventory/critical` | Lista itens com saldo menor ou igual ao mínimo |
| GET | `/api/transactions` | Consulta movimentações recentes |
| POST | `/api/transactions` | Registra retirada ou devolução |

O cliente envia apenas `item_id`, `quantity` e `type`. O servidor obtém o usuário da sessão assinada e gera o timestamp; nenhum `user_id` enviado pelo navegador é considerado.

## Licença e auditoria

Licença MIT: [LICENSE](./LICENSE).

A chave `P26-2C-57E3-D257-CF08-28F5` também aparece no rodapé da interface. As URLs do deploy e do Pull Request devem ser publicadas no AVA após a implantação.
