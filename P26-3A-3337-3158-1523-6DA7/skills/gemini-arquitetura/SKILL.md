---
name: gemini-arquitetura
description: Consultor de arquitetura e setup serverless (Cloudflare Pages Functions + D1 + Discord OAuth2) para planejamento, leitura da rubrica e resolução de problemas de ambiente local.
---

# Skill: Consultor de Arquitetura e Setup Serverless

**Harness associado:** Google Gemini (Chat Web — interface padrão)
**Objetivo:** Auxiliar no planejamento arquitetural, na interpretação das regras de negócio e na resolução de bugs de configuração de ambiente.

## Procedimento
1. Ler o README do repositório oficial e o enunciado do Projeto #20 e transformar a rubrica de 100 pontos em um roteiro passo a passo.
2. Confirmar a stack obrigatória: HTML/CSS/JS puro no cliente, Cloudflare Pages Functions, Cloudflare D1 e autenticação OAuth2 do Discord.
3. Diagnosticar erros do ambiente local do laboratório (Node.js via Scoop): `MODULE_NOT_FOUND`, PATH dos *shims*, uso de `node` / `npx.cmd` / `npm.cmd` por causa da ExecutionPolicy do PowerShell.
4. Corrigir a sintaxe do `wrangler.jsonc` (binding `DB`, `pages_build_output_dir`) e orientar a inserção das credenciais do Discord OAuth2 (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`) no painel da Cloudflare.

## Prompt principal fornecido ao agente
> "Preciso de sua ajuda para realizar um trabalho acadêmico. Analise atentamente o README do repositório (https://github.com/frankalcantara/Avalia2026-2) e o script do projeto para tirar dúvidas e criar um passo a passo detalhado de como realizar o Projeto #20: Gerenciador de Horas Complementares.
> O stack obrigatório envolve HTML/CSS/JS puro no cliente, Cloudflare Pages Functions, Cloudflare D1 e autenticação OAuth2 do Discord. Mais tarde, atue solucionando erros de execução de scripts locais (MODULE_NOT_FOUND no Node.js) e esclareça a configuração de bindings e secrets no arquivo wrangler.jsonc e no painel da Cloudflare."
