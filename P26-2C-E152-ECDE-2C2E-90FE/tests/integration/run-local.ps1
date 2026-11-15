$ErrorActionPreference = "Stop"
node --test tests/integration/rooms-local.test.mjs
exit $LASTEXITCODE
