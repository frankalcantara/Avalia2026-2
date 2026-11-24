# Roteiro de demonstração e estudo

Use duas contas Discord, A (dono) e B (colega), em navegadores ou perfis diferentes. Combine a participação do colega. Não compartilhe senhas.

## Empréstimo

1. A entra com Discord. Confira nome, handle e avatar. Cadastre um livro físico real em Meus livros, modalidade Empréstimo ou ambos.
2. B entra, encontra o livro no catálogo e pede empréstimo. Inclua uma sugestão de local para a entrega presencial.
3. Confira que o estado passou para Reservado e o pedido aparece nos painéis de A e B.
4. A abre Pedidos → Recebidos, aprova e informa uma data futura. Confira estado Emprestado, nome do solicitante e data prevista.
5. Demonstre o contato pelo handle do Discord. O site não envia mensagens automaticamente.
6. Após o retorno físico, A registra a devolução. Confira que o livro ficou Disponível e o histórico manteve o pedido.

## Troca

1. A e B cadastram um exemplar cada em modalidade Troca ou ambos.
2. B solicita o livro de A e oferece seu próprio exemplar.
3. Confira a reserva dos dois livros. A aprova e ambos combinam a entrega.
4. Depois da entrega, A confirma a conclusão. Confira os exemplares nos acervos dos novos proprietários e o histórico preservando os participantes originais.

## Outros casos

- Recusar um pedido e conferir liberação do livro.
- Cancelar um pedido pendente pelo solicitante.
- Conferir busca e filtros e editar/remover um exemplar disponível próprio.
- Abrir em celular, verificar navegação, formulários, mensagens e rodapé com a chave.
- Sair da conta e tentar cadastrar/solicitar: o sistema exige novo login.

## O que explicar ao professor

- O cliente usa somente HTML, CSS e JavaScript, consumindo JSON por fetch.
- Pages Functions verificam a sessão e as permissões; esconder um botão não basta para proteger uma ação.
- D1 guarda usuários, sessões, livros, pedidos e reservas. Sessões são armazenadas como hashes.
- Uma reserva bloqueia um exemplar por vez; uma troca bloqueia dois na mesma transação. Se houver conflito, não pode restar metade da troca reservada.
- OAuth2 retorna a identidade Discord. O navegador nunca recebe o Client Secret.
- Os três agentes tiveram áreas diferentes e o agente de testes escreveu cenários independentes; o relatório distingue teste automatizado, teste visual e teste online real.

Leia `docs/CONTRATO-API.md`, `docs/BACKEND.md` e `AGENTS.md` para localizar no código cada explicação. Demonstre apenas verificações que de fato executou.
