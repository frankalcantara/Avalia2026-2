# Agente especializado — Backend e persistência

## Revisão

- Conferiu OAuth2 Discord com escopo `identify`, validação de `state` e sessão assinada.
- Conferiu persistência dos perfis, recursos e reservas no Cloudflare D1.
- Revisou validações de datas, duração, conflito de horários e limite diário de 120 minutos.
- Confirmou uso de parâmetros vinculados nas consultas e cancelamento somente pelo titular antes do início.
