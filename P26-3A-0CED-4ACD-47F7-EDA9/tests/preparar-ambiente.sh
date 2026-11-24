#!/usr/bin/env bash
# Prepara o ambiente local para os testes de API e interface:
#  - cria um .dev.vars temporário (não versionado) se não existir
#  - aplica a migração no D1 local
#  - insere 2 usuários, 2 sessões (só o SHA-256 do token vai para o banco) e 1 guild do usuário 1
# Uso (na pasta do projeto ou de qualquer lugar):
#   eval "$(bash tests/preparar-ambiente.sh)"
# Ao final imprime as linhas "export TEST_TOKEN=..." e "export TEST_TOKEN_2=...".
# Limpeza depois dos testes: rm -rf .dev.vars .wrangler
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v wrangler >/dev/null 2>&1; then W="wrangler"; else W="npx wrangler"; fi

if [ ! -f .dev.vars ]; then
  printf 'WORD_SECRET=teste-local\nDISCORD_CLIENT_ID=x\nDISCORD_CLIENT_SECRET=y\n' > .dev.vars
  echo "# .dev.vars temporário criado" >&2
fi

TOKEN1="${TEST_TOKEN:-$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')}"
TOKEN2="${TEST_TOKEN_2:-$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')}"
HASH1="$(printf '%s' "$TOKEN1" | sha256sum | cut -d' ' -f1)"
HASH2="$(printf '%s' "$TOKEN2" | sha256sum | cut -d' ' -f1)"
EXPIRES="$(node -e 'console.log(Date.now() + 30 * 86400000)')"

CI=1 $W d1 migrations apply DB --local >&2

SQL="INSERT OR REPLACE INTO users (user_id, username, global_name, avatar_url) VALUES
  ('100000000000000001', 'teste1', 'Teste Um', 'https://cdn.discordapp.com/embed/avatars/1.png'),
  ('100000000000000002', 'teste2', 'Teste Dois', 'https://cdn.discordapp.com/embed/avatars/2.png');
INSERT OR REPLACE INTO sessions (token_hash, user_id, expires_at) VALUES
  ('$HASH1', '100000000000000001', $EXPIRES),
  ('$HASH2', '100000000000000002', $EXPIRES);
INSERT OR REPLACE INTO user_guilds (user_id, guild_id, guild_name, guild_icon) VALUES
  ('100000000000000001', '900000000000000001', 'Turma Teste', NULL);"

$W d1 execute DB --local --command "$SQL" >&2

echo "export TEST_TOKEN=$TOKEN1"
echo "export TEST_TOKEN_2=$TOKEN2"
