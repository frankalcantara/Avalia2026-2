# Relatório de teste

Verificações locais e de produção concluídas. O teste de login Discord foi confirmado pelo usuário; a integração GitHub foi conferida nas configurações do Cloudflare Pages.

| Verificação | Resultado | Evidência / observação |
|---|---|---|
| URL HTTPS abre sem erro | OK | `https://financeiro-bj1.pages.dev/` retornou HTTP 200 e foi aberta no navegador. |
| Login Discord mostra nome e avatar | OK | Login interativo concluído e nome/avatar confirmados pelo usuário; credenciais guardadas como secrets no Cloudflare. |
| Sem login, `/api/transactions` retorna 401 | OK | Pages Functions local e endpoint HTTPS publicado retornaram HTTP 401 sem sessão. |
| Criar, listar, editar e excluir funcionam | OK | Teste HTTP local autenticado com D1: POST, GET, PUT e DELETE aprovados. |
| Valor inválido é rejeitado no servidor | OK | POST rejeitou texto, zero, negativo e data inválida com HTTP 400. |
| Um usuário não vê dados de outro | OK | Segundo usuário recebeu lista vazia e não pôde excluir a transação do primeiro (404). |
| Filtros por mês e categoria funcionam | OK | Consulta local filtrada por `month` e `category` retornou o registro esperado. |
| Saldo líquido correto | OK | Saldo calculado no D1 e recalculado após edição, em centavos, conferido no teste HTTP. |
| Gráfico só com div e proporcional | OK | DOM construído com `div`; largura relativa ao maior gasto e percentual do total. |
| Responsivo (celular e desktop) | OK | Navegador local conferido em 390px e 1280px, sem rolagem horizontal; CSS adaptativo. |
| Sem frameworks no frontend | OK | HTML, CSS e JavaScript nativos; sem dependências de interface. |
| Chave Única no README e no rodapé | OK | Presente nos dois locais solicitados. |
| LICENSE MIT, repositório público, agents/harness/skills presentes | OK | Fork público, LICENSE MIT, três agentes, harness, skills e pasta do projeto no PR #27; o PR permanece aberto para avaliação oficial. |

## Evidência de teste local

- Wrangler 4.161.0 compilou as Pages Functions e iniciou o site local; a rota protegida retornou HTTP 401 sem cookie.
- 11 verificações HTTP passaram com D1 local e cookies de sessão assinados para dois usuários de teste: perfil, criação/listagem/edição/exclusão, filtros, saldo, rejeição de valores inválidos/data inválida e isolamento.
- 10 verificações adicionais passaram contra o D1 e as Functions em produção com sessões temporárias assinadas; usuários e transações de teste foram removidos e o `SESSION_SECRET` foi rotacionado em seguida.
- Navegador: formulário de criação, filtro, edição e exclusão testados; saldo e gráfico conferidos; viewport móvel de 390px sem overflow horizontal.
- Cloudflare Pages: deploy HTTPS ativo; `/api/transactions` sem sessão retorna 401 e `/api/login` redireciona ao Discord com callback/state.
- Git integration: Pages conectado ao repositório `MatheusPinho-Dev-BR/Avalia2026-2`, raiz `P26-2C-7DDD-9039-3A0D-D491`, saída `public`, branch de produção `submission/P26-2C-7DDD-9039-3A0D-D491-upstream`; deploy automático após conexão observado.
- PR oficial #27 aberto e validado pelo workflow inicial do repositório; merge/nota aguardam avaliação oficial.
