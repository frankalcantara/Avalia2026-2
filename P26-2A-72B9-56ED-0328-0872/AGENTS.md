# Agentes e harness de desenvolvimento

## Harness

O trabalho foi desenvolvido e revisado no harness multiagente do Codex. O agente principal integrou o produto e os três agentes especializados fizeram revisões independentes com foco em domínio, backend e interface. O agente de teste e validação conferiu regras, suíte local e publicação. As skills aplicadas estão documentadas em `skills/`.

## Agente 1 — Produto e requisitos

Mapeou o Projeto #40 para o fluxo de timesheet: cronômetro, apontamento manual, quatro etapas de engenharia, estimativas e comparação entre horas previstas e realizadas. Organizou os critérios de aceite e a documentação.

## Agente 2 — Backend e persistência

Revisou o Worker e o Cloudflare D1, com foco na autenticação OAuth2 do Discord, ownership dos registros, cronômetros ativos, validação dos apontamentos e persistência das estimativas. Skill: `skills/backend/SKILL.md`.

## Agente 3 — Interface e acessibilidade

Revisou o painel em JavaScript vanilla, estados de autenticação, cronômetro, formulários, resumo de horas, comparativo de estimativas e apresentação responsiva. Skill: `skills/frontend/SKILL.md`.

## Agente 4 — Teste e validação

Agente obrigatório de QA. Verificou as regras de negócio com testes de integração no Worker e D1 locais, incluindo início e encerramento de cronômetro, lançamentos manuais, estimativas e exigência de sessão. Também conferiu o deploy e o fluxo Discord. Skill: `skills/testing/SKILL.md`.

## Skills

- `skills/product/SKILL.md` — requisitos e critérios de aceite.
- `skills/backend/SKILL.md` — Worker, D1 e segurança de sessão.
- `skills/frontend/SKILL.md` — HTML, CSS e JavaScript vanilla.
- `skills/testing/SKILL.md` — testes de integração e validação remota.
