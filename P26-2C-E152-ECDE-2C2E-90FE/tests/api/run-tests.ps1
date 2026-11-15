$ErrorActionPreference = "Stop"
node --test tests/api/health.test.js tests/api/auth.test.js tests/api/spotify.test.js
exit $LASTEXITCODE
