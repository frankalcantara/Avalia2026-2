# Engenharia de agentes — Projeto 20

**Harness escolhido:** OpenCode. O harness é o ambiente que disponibiliza ferramentas de edição, terminal e leitura de skills aos agentes. Definições em `.opencode/agents/*.md`, skills carregáveis em `.opencode/skills/<nome>/SKILL.md` e cópias auditáveis na pasta `skills/`.

| Agente | Arquivo | Responsabilidade | Skill |
|---|---|---|---|
| Desenvolvedor | `.opencode/agents/desenvolvedor.md` | Implementação frontend/backend | `frontend-vanilla` |
| Segurança | `.opencode/agents/seguranca.md` | Revisão OAuth2, sessão e autorização | `seguranca-serverless` |
| Testes e Validação | `.opencode/agents/testes.md` | Testes de API, horas e publicação | `testes-projeto` |

## Importante sobre evidências
Os três agentes estão **configurados**, mas o simples fato de existir arquivo não comprova execução. O aluno deve realmente invocar cada agente no OpenCode e registrar evidências verificáveis neste documento (data, tarefa, arquivos revisados, resumo do output e testes realizados). **Não inventar logs ou afirmar execução sem executar.**

## Roteiro de utilização e registro
1. Abra o diretório da chave no terminal e execute `opencode` (após instalar).
2. Use `@desenvolvedor` para revisar layout e validar funcionalidade de cadastro.
3. Use `@seguranca` para revisar OAuth2 e isolamento entre estudantes.
4. Use `@testes` para executar a bateria de testes e apontar problemas.
5. Anexe abaixo um resumo real da execução e o resultado, e faça commit.

## Registro de execução (a preencher após uso real)
- Desenvolvedor: **não executado neste pacote**.
- Segurança: **não executado neste pacote**.
- Testes e validação: **não executado neste pacote**.

## Agente 1 — Desenvolvedor
Configuração no OpenCode, skill frontend-vanilla. A execução ainda deve ser registrada.

## Agente 2 — Segurança
Configuração no OpenCode, skill seguranca-serverless. A execução ainda deve ser registrada.

## Agente 3 — Testes e Validação
Configuração no OpenCode, skill testes-projeto. A execução ainda deve ser registrada.
