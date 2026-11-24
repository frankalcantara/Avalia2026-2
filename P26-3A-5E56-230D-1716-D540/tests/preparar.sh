#!/usr/bin/env bash
# Zera o D1 LOCAL, aplica as migrações e semeia usuários/sessões/itens de teste.
# NUNCA usa --remote. Uso (da pasta da chave): bash tests/preparar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export WRANGLER_SEND_METRICS=false CI=1

echo "== preparar: apagando .wrangler/state (D1 local)"
rm -rf .wrangler/state

echo "== preparar: migrações locais"
npx wrangler d1 migrations apply DB --local

SQL=$(mktemp --suffix=.sql)
trap 'rm -f "$SQL"' EXIT
node tests/semente.mjs > "$SQL"
echo "== preparar: semente ($(wc -l < "$SQL") instruções)"
npx wrangler d1 execute DB --local --file "$SQL" >/dev/null
npx wrangler d1 execute DB --local --command "SELECT (SELECT COUNT(*) FROM usuarios) AS usuarios, (SELECT COUNT(*) FROM sessoes) AS sessoes, (SELECT COUNT(*) FROM itens) AS itens"
