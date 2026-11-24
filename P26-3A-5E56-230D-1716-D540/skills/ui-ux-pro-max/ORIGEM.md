# Origem desta skill (terceiros)

Copiada de https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (pasta `.claude/skills/ui-ux-pro-max`,
commit `4f2dbb67e64969a9a30ab00742f2d55d66ddec2b`), licença **MIT** (ver `LICENSE-MIT-terceiros`).
Equivale a `npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max`, mas versionada no
repositório. Removida só a pasta `scripts/tests`. Inspecionada antes do uso: os scripts Python usam apenas a
biblioteca padrão e consultam CSVs locais (sem rede); só gravam arquivos com `--persist`.

Usada pelo **Agente Programador Front-end** (revisão de UI/UX), dentro das restrições do projeto:
HTML/CSS/JS puro (os resultados para Tailwind/React servem só como referência de design), CSP `'self'`
(sem Google Fonts por CDN) e paleta institucional azul/amarelo/branco.
