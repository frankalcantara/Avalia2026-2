---
name: github-cli-actions
description: Operações autônomas com GitHub CLI (gh) para forks, subpastas, branches, PRs, secrets e automação CI/CD com GitHub Actions.
---

# GitHub CLI (`gh`) & GitHub Actions Playbook

## 1. Operações via GitHub CLI (`gh`)
Execute sempre de forma não-interativa:
```bash
# Validar autenticação
gh auth status

# Fazer fork e clonar repositório
gh repo fork <owner>/<repo> --clone

# Criar branch de trabalho
git checkout -b feat/entrega-projeto

# Configurar secrets no fork para GitHub Actions
gh secret set CLOUDFLARE_API_TOKEN --body "$CLOUDFLARE_API_TOKEN"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$CLOUDFLARE_ACCOUNT_ID"
gh secret set DISCORD_CLIENT_ID --body "$DISCORD_CLIENT_ID"
gh secret set DISCORD_CLIENT_SECRET --body "$DISCORD_CLIENT_SECRET"
gh secret set SESSION_SECRET --body "$SESSION_SECRET"

# Criar Pull Request
gh pr create --title "feat: entrega do projeto" --body "Implementação validada com testes automatizados e deploy ativo."

# Monitorar execução do GitHub Actions
gh run list --limit 5
gh run watch
```

## 2. Workflow CI/CD Compatível com Raiz ou Subpasta (`.github/workflows/ci-deploy.yml`)
Substitua `<PROJECT_DIR>` por `.` (se o projeto estiver na raiz) ou pelo nome da subpasta (se estiver em um monorepo/fork):

```yaml
name: CI & Cloudflare Deploy

on:
  push:
    branches: [main]
    paths:
      - '<PROJECT_DIR>/**'
      - '.github/workflows/ci-deploy.yml'
  pull_request:
    branches: [main]
    paths:
      - '<PROJECT_DIR>/**'

jobs:
  test-and-validate:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: <PROJECT_DIR>
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies (if package.json exists)
        if: hashFiles('<PROJECT_DIR>/package.json') != ''
        run: npm ci || npm install

      - name: Validate D1 SQL Migrations Locally
        run: npx wrangler d1 migrations apply DB --local

      - name: Run Automated Test Suite
        run: node --test tests/**/*.test.js

  deploy-cloudflare:
    needs: test-and-validate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Apply Remote D1 Migrations
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: <PROJECT_DIR>
          command: d1 migrations apply DB --remote

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: <PROJECT_DIR>
          command: pages deploy public --project-name=${{ vars.CF_PAGES_PROJECT }}
```