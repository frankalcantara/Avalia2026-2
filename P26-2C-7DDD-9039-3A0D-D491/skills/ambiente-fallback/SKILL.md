# Skill: ambiente-fallback

1. Antes de executar as etapas, conferir `node -v`, `npm -v`, `git --version` e `npx wrangler --version`.
2. Se Node estiver ausente, tentar `scoop install nodejs-lts`; alternativamente, usar GitHub Codespaces.
3. Se Git estiver ausente, usar o envio de arquivos pelo GitHub Web.
4. Preferir `npx wrangler`; se o terminal não estiver disponível, configurar os recursos pelo painel Cloudflare.
5. Sem internet, executar as verificações locais possíveis e deixar publicação e testes remotos explicitamente pendentes.
6. Registrar falhas e as alternativas tentadas; nunca esconder uma etapa não executada.
