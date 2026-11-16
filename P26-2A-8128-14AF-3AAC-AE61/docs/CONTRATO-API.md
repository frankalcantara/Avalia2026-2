# Contrato da aplicação EntreLivros

Projeto 24 — P26-2A-8128-14AF-3AAC-AE61. Valores JSON e colunas em snake_case.

## Identidade
- `GET /api/me` -> `{user: null}` ou `{user:{user_id,username,display_name,avatar}}`. `username` é o handle real do Discord; `display_name` é o nome visível.
- `GET /api/auth/discord` e `GET /api/auth/discord/callback`: OAuth2 real, escopo identify, state aleatório e de uso único.
- `POST /api/logout` -> `{ok:true}`.
- Cookies HttpOnly e SameSite=Lax; Secure em HTTPS. Sessões opacas aleatórias, somente hash persistido no D1; nenhuma identidade recebida do cliente é confiável.
- Escritas exigem Origin igual ao origin da requisição e sessão válida. JSON obrigatório. Erros `{error: "mensagem em português"}` com status apropriado.

## Livros
- `GET /api/books?q=&category=&status=&mode=` -> `{books:[...]}`. Leitura pública.
- `POST /api/books` body `{title,author,category,condition,description,mode}` -> `{book}` (201).
- `PATCH /api/books/:id` mesmos campos editáveis -> `{book}`. Apenas dono e exemplar disponível.
- `DELETE /api/books/:id` -> `{ok:true}`. Apenas dono e exemplar disponível; preservar histórico com exclusão lógica.
- Livro: `{id,owner_id,title,author,category,condition,description,mode,status,owner_name,owner_username,created_at}`.
- `category`: `tecnico` ou `literario`. `condition`: `novo`, `bom`, `marcas`. `mode`: `emprestimo`, `troca`, `ambos`. `status`: `disponivel`, `reservado`, `emprestado`.
- `GET /api/dashboard` autenticado -> `{books:[livros próprios],incoming:[pedidos recebidos],outgoing:[pedidos feitos]}`.

## Pedidos
- `POST /api/requests` body `{book_id,type,message,offered_book_id?}` -> `{request}` (201).
- `type`: `emprestimo` ou `troca`. Troca exige oferecimento de livro disponível do solicitante, com modalidade troca/ambos. Não solicitar livro próprio.
- Pedido pendente reserva o(s) exemplar(es); aceitar somente se disponíveis e impedir disputa/duplicidade atomicamente no banco.
- `PATCH /api/requests/:id` body `{action,due_date?}` -> `{request}`.
- `action`: `approve`, `reject`, `cancel`, `return`, `complete_exchange`.
- Dono aprova/rejeita; solicitante cancela enquanto pendente. Empréstimo aprovado exige due_date YYYY-MM-DD futura; status livro emprestado. Dono registra devolução e libera livro.
- Troca aprovada permanece reservada até `complete_exchange` pelo dono; ao concluir, transferir os dois exemplares entre os usuários e liberar ambos. Preservar donos originais no histórico do pedido.
- Pedido: `{id,book_id,book_title,owner_id,requester_id,requester_name,requester_username,owner_name,owner_username,type,status,message,due_date,offered_book_id,offered_book_title,created_at}`.
- `status` do pedido: `pendente`, `aprovado`, `recusado`, `cancelado`, `devolvido`, `concluido`.
- Contato via handle do Discord nos pedidos e catálogo. A interface exibe rótulos em português e datas pt-BR.

## Limites de segurança e testes
- Validar tamanhos, enumerações, datas, autorização e transições no servidor, queries parametrizadas e transações D1/batch + constraints/triggers para reservas concorrentes.
- Nenhum login de demonstração ou endpoint de criação de sessão em produção. Testes podem preparar sessões diretamente em banco LOCAL isolado.
- Não carregar dados fictícios automaticamente no catálogo de produção.
