#!/usr/bin/env bash
# Testes de API ponta a ponta contra o app LOCAL:
#   1) tests/preparar.sh (zera D1 local + migra + semeia)
#   2) sobe `wrangler pages dev` em background
#   3) node --test tests/api.test.mjs
#   4) derruba o servidor pelos PIDs (wrapper npx, wrangler, workerd) — sem pkill -f.
# Uso (da pasta da chave): npm run test:api   (PORTA=8788 por padrão)
set -uo pipefail
cd "$(dirname "$0")/.."
export WRANGLER_SEND_METRICS=false CI=1
PORTA="${PORTA:-8788}"
BASE="http://localhost:${PORTA}"
LOG="$(mktemp --suffix=-wrangler-dev.log)"

if curl -s -o /dev/null --max-time 2 "$BASE/"; then
  echo "ERRO: já existe algo escutando em $BASE — derrube-o ou use PORTA=<outra>." >&2
  exit 2
fi

bash tests/preparar.sh || { echo "ERRO: preparar.sh falhou" >&2; exit 2; }

echo "== servidor: npx wrangler pages dev --port $PORTA (log: $LOG)"
npx wrangler pages dev --port "$PORTA" >"$LOG" 2>&1 &
WRAP=$!

descendentes() { local p; for p in $(pgrep -P "$1" 2>/dev/null); do echo "$p"; descendentes "$p"; done; }
derrubar() {
  local pids
  pids="$WRAP $(descendentes "$WRAP" | tr '\n' ' ')"
  echo "== servidor: derrubando PIDs $pids"
  kill $pids 2>/dev/null
  for _ in $(seq 1 20); do
    vivos=0; for p in $pids; do kill -0 "$p" 2>/dev/null && vivos=1; done
    [ "$vivos" = 0 ] && break; sleep 0.5
  done
  for p in $pids; do kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null; done
  return 0
}
trap derrubar EXIT

for i in $(seq 1 90); do
  if curl -s -o /dev/null --max-time 2 "$BASE/api/status"; then break; fi
  if ! kill -0 "$WRAP" 2>/dev/null; then echo "ERRO: wrangler morreu:" >&2; tail -40 "$LOG" >&2; exit 2; fi
  sleep 1
done
curl -s --max-time 5 "$BASE/api/status"; echo

BASE_URL="$BASE" node --test --test-concurrency=1 tests/api.test.mjs
rc=$?
if [ "$rc" != 0 ]; then echo "== últimas linhas do log do wrangler:"; tail -30 "$LOG"; fi
exit "$rc"
