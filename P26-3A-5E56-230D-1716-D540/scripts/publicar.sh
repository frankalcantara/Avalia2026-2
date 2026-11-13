#!/usr/bin/env bash
# Publicacao automatica (Agente Publicador Cloudflare) — skills/deploy-cloudflare-pages/SKILL.md
# Uso (de dentro da pasta da chave): bash scripts/publicar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PROJETO=achados-perdidos-campus
URL=https://achados-perdidos-campus.pages.dev
CHAVE=P26-3A-5E56-230D-1716-D540

echo "== 1. Pre-voo"
npx wrangler whoami | grep -E "email|Account" || true
grep -q '"DISCORD_CLIENT_ID": "PREENCHER' wrangler.jsonc && { echo "ERRO: DISCORD_CLIENT_ID nao preenchido em wrangler.jsonc"; exit 1; }
npx wrangler pages secret list --project-name "$PROJETO" | grep -q DISCORD_CLIENT_SECRET \
  || { echo "ERRO: falta o secret. Rode: npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name $PROJETO"; exit 1; }

echo "== 2. Migracoes D1 remotas"
npx wrangler d1 migrations apply DB --remote

echo "== 3. Deploy"
npx wrangler pages deploy --project-name "$PROJETO" --branch main --commit-dirty=true

echo "== 4. Verificacao pos-deploy"
sleep 5
falhou=0
checa() { if eval "$2"; then echo "  OK  $1"; else echo "  FALHOU  $1"; falhou=1; fi; }
checa "home 200 com a chave"      "curl -fsS $URL/ | grep -q $CHAVE"
checa "api/status d1+oauth"       "curl -fsS $URL/api/status | grep -q '\"d1\":true' && curl -fsS $URL/api/status | grep -q '\"oauth_configurado\":true'"
checa "login redireciona Discord" "curl -sS -o /dev/null -w '%{redirect_url}' $URL/api/auth/discord | grep -q discord.com"
checa "cabecalho CSP"             "curl -sSI $URL/ | grep -qi content-security-policy"
checa "api/itens 200"             "curl -fsS -o /dev/null $URL/api/itens"
exit $falhou
