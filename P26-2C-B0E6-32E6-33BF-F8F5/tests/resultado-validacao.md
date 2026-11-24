# Resultado da validação da API

Executado em 2026-11-20T20:05:45.196Z contra http://localhost:8788 (D1 local).

| ID | Teste | Esperado | Obtido | Resultado |
|---|---|---|---|---|
| 1.1 | GET slots sem login | 401 | 401 | OK |
| 1.2 | GET bookings sem login | 401 | 401 | OK |
| 1.3 | POST bookings sem login (Origin certo) | 401 | 401 | OK |
| 1.4 | DELETE bookings sem login | 401 | 401 | OK |
| 1.5 | DELETE slots sem login | 401 | 401 | OK |
| 1.6 | POST sem header Origin | 403 | 403 | OK |
| 1.7 | POST logado com Origin de outro site | 403 | 403 | OK |
| 1.8 | PUT em /api/slots/1 | 404/405 | 405 | OK |
| 2.1 | criar 4 horários | 201 | 201 | OK |
| 2.1b | created=4 e requested=4 | verdadeiro | {"created":4,"requested":4} | OK |
| 2.2 | repetir a mesma janela | 201 | 201 | OK |
| 2.2b | created=0 (idempotente) | verdadeiro | {"created":0,"requested":4} | OK |
| 2.3 | datas em texto | 400 | 400 | OK |
| 2.4 | início não inteiro | 400 | 400 | OK |
| 2.5 | fora de múltiplos de 30 min | 400 | 400 | OK |
| 2.6 | fim igual ao início | 400 | 400 | OK |
| 2.7 | janela maior que 8 h | 400 | 400 | OK |
| 2.8 | janela no passado | 400 | 400 | OK |
| 2.9 | mais de 60 dias de antecedência | 400 | 400 | OK |
| 2.10 | JSON quebrado | 400 | 400 | OK |
| 2.11 | JSON é um array | 400 | 400 | OK |
| 2.12 | corpo maior que 4 KB | 413 | 413 | OK |
| 2.13 | intervalo de listagem vazio | 400 | 400 | OK |
| 2.14 | intervalo de listagem maior que 8 dias | 400 | 400 | OK |
| 3.0 | 4 horários do monitor 1 visíveis ao aluno | verdadeiro | 4 | OK |
| 3.1 | slot_id em texto | 400 | 400 | OK |
| 3.2 | tema curto (2 caracteres) | 400 | 400 | OK |
| 3.3 | tema longo (301 caracteres) | 400 | 400 | OK |
| 3.4 | tema só com espaços | 400 | 400 | OK |
| 3.5 | tema numérico | 400 | 400 | OK |
| 3.6 | slot inexistente | 404 | 404 | OK |
| 3.7 | monitor reserva o próprio horário | 403 | 403 | OK |
| 3.8 | JSON null | 400 | 400 | OK |
| 3.9 | reserva válida | 201 | 201 | OK |
| 3.10 | mesma reserva de novo | 409 | 409 | OK |
| 3.11 | aluno vê a própria reserva em /api/bookings | verdadeiro |  | OK |
| 3.12 | outro aluno vê o horário ocupado sem tema, nome nem id da reserva | verdadeiro | {"topic":null,"student":null} | OK |
| 3.13 | monitor vê tema e nome do aluno | verdadeiro | Aluno Teste | OK |
| 4.1 | exatamente 1 × 201 e 11 × 409 | verdadeiro | 201,409,409,409,409,409,409,409,409,409,409,409 | OK |
| 4.2 | banco sem reserva duplicada | verdadeiro |  | OK |
| 4.3 | UNIQUE(slot_id) existe na tabela bookings | verdadeiro |  | OK |
| 5.1 | primeira reserva (T) | 201 | 201 | OK |
| 5.2 | mesmo horário com outro monitor | 409 | 409 | OK |
| 5.3 | horário adjacente (T+30min) | 201 | 201 | OK |
| 6.1 | terceiro (monitor 2) cancela reserva alheia | 403 | 403 | OK |
| 6.2 | aluno cancela a própria reserva | 204 | 204 | OK |
| 6.3 | cancelar de novo | 404 | 404 | OK |
| 6.4 | monitor do horário cancela a reserva | 204 | 204 | OK |
| 6.5 | reserva inexistente | 404 | 404 | OK |
| 6.6 | id de reserva inválido (abc) | 400/404 | 404 | OK |
| 6.7 | id de horário inválido (abc) | 400/404 | 404 | OK |
| 7.1 | monitor remove horário com aluno agendado | 409 | 409 | OK |
| 7.2 | aluno remove horário do monitor | 403 | 403 | OK |
| 7.3 | monitor remove horário livre | 204 | 204 | OK |
| 7.4 | horário inexistente | 404 | 404 | OK |
| 7.5 | remove o horário depois do cancelamento | 204 | 204 | OK |
| 8.1 | monitor abre 16 horários | 201 | 201 | OK |
| 8.2 | 10 × 201 e depois 409 (11ª reserva) | verdadeiro | 201,201,201,201,201,201,201,201,201,201,409 | OK |
| 8.3 | aluno tem exatamente 10 reservas | verdadeiro |  | OK |
| 8.4 | após cancelar 1, a 11ª reserva passa | 201 | 201 | OK |
| 8.5 | 12 simultâneas: exatamente 10 × 201 e 2 × 409 | verdadeiro | 201,201,201,201,201,201,201,201,201,201,409,409 | OK |
| 9.1 | reservar horário que já passou | 400 | 400 | OK |
| 9.2 | cancelar reserva de horário que já começou | 400 | 400 | OK |
| 9.3 | reserva passada não aparece em /api/bookings | verdadeiro |  | OK |
| 10.1 | 14 janelas de 16 horários, todas com 201 | verdadeiro |  | OK |
| 10.2 | total criado = 200 (e não 224) | verdadeiro | 200 | OK |
| 10.3 | banco confirma 200 horários futuros do monitor | verdadeiro |  | OK |
| 11.1 | tema com HTML é aceito como texto | 201 | 201 | OK |
| 11.2 | a API devolve o tema sem alterar (o front usa textContent) | verdadeiro |  | OK |
| 11.3 | PATCH em /api/slots/1 | 404/405 | 405 | OK |

**Total:** 70 testes, 70 OK, 0 FALHA.