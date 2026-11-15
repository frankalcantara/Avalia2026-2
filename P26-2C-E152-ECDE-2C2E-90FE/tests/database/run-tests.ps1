$ErrorActionPreference = "Stop"
node --test tests/database/migrations.test.mjs
exit $LASTEXITCODE
