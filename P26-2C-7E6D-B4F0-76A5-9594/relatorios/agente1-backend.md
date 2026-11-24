# Relatório do Agente 1 (Backend / Serverless)

- Data: 18/11/2026
- Skill seguida: skills/serverless-d1-discord/SKILL.md
- Harness: chat do Claude (claude.ai), sem modo agente. Papel assumido numa conversa única, junto com os agentes 2 e 3.
- Método: o aluno executou buscas (Select-String) no código e colou os resultados para a análise.

## Regras da skill
1. Validação na borda: PASSA. functions/api/atividades.js usa readSession em GET e POST (linhas 20 e 33). O user_id vem só do cookie assinado. Título, categoria, horas e link são validados no servidor, e o teto de horas é aplicado no próprio INSERT.
2. Queries parametrizadas: PASSA. Todas as consultas usam env.DB.prepare(...).bind(...) (atividades.js, callback.js e status.js).
3. Sessão Discord OAuth2: PASSA. Cookie discord_session com HttpOnly, Secure, SameSite=Lax, assinado com HMAC-SHA256 e com validade de 24h. O state do OAuth também fica em cookie HttpOnly.

## Riscos encontrados (não corrigidos, ficam como melhoria futura)
- callback.js ignora erros na gravação do usuário em discord_users (catch vazio). Se falhar, o login continua e o cadastro de atividade falha pela chave estrangeira.
- callback.js ainda executa CREATE TABLE IF NOT EXISTS em tempo de execução, o que é redundante com as migrations.
- O cookie oauth_state não é apagado depois de usado.

## Ponto levantado e corrigido depois
- As validações respondiam 422. A skill de teste lista 400/401/403/409. Corrigido: validações = 400 e teto excedido = 409 (ver relatório do Agente 3).