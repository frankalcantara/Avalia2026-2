---
name: validacao-e-testes
description: Checklist e procedimentos de teste do Quadro de Caronas: testes estáticos, unitários, de API pública e roteiro manual de login com Discord.
---

# Validação e testes

## Automático
- `npm test`: verifica chave no README e no rodapé, LICENSE MIT, schema e funções, ausência de frameworks de UI, 3 agentes e seus skills, e testa as regras de validação de rota.
- `npm test -- https://SEU-PROJETO.pages.dev`: acrescenta testes online (página abre com a chave, APIs protegidas respondem 401, login redireciona ao Discord com state, POST de outra origem recebe 403).

## Manual (precisa de conta Discord)
1. Entrar com Discord e ver nome e avatar no topo.
2. Cadastrar rota com data/horário futuros; tentar horário passado e ver recusa.
3. Com segunda conta: filtrar rotas do dia e reservar; conferir que as vagas diminuem.
4. Tentar reservar duas vezes: deve recusar. Reservar a última vaga com duas contas ao mesmo tempo: só uma passa.
5. No painel do motorista, conferir passageiro com ID do Discord.
6. Cancelar reserva e ver a vaga voltar. Sair e ver que as APIs voltam a exigir login.

## Relatório
Cada item: executado ou pendente, resultado, arquivo e agente responsável pela correção.
