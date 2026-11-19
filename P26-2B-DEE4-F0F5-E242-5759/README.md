# Projeto #31: Quadro de Caronas Universitárias

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Guilherme Rodrigo Senter Machado
- **Turma:** 2B
- **Chave Única:** `P26-2B-DEE4-F0F5-E242-5759`
- **URL_CLOUDFLARE:** `https://projeto-p26-2b-dee4-f0f5-e242-5759.pages.dev`
---

## Especificação do Projeto

Implemente um sistema de coordenação de caronas solidárias entre estudantes que se deslocam para o campus. Através do login OAuth2 do Discord, o usuário que possui veículo pode cadastrar uma rota informando bairro de origem, destino, horário de saída e número de lugares vagos disponíveis no carro.

Estudantes que buscam transporte podem filtrar as rotas ativas do dia e solicitar reserva de uma vaga. A Cloudflare Function processa a solicitação decrementando o contador de assentos disponíveis no Cloudflare D1 de forma atômica, listando os passageiros confirmados (com seus respectivos identificadores do Discord) no painel do motorista para que combinem o ponto exato de encontro.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2B-DEE4-F0F5-E242-5759`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2B-DEE4-F0F5-E242-5759
   npx.cmd wrangler d1 create db-p26-2b-dee4-f0f5-e242-5759
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2b-dee4-f0f5-e242-5759`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2b-dee4-f0f5-e242-5759.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
       - `SESSION_SECRET` (segredo independente, gerado aleatoriamente com pelo menos 32 bytes de entropia, em formato texto)
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2B-DEE4-F0F5-E242-5759` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.

## API de caronas

| Método e rota | Acesso | Resultado |
| --- | --- | --- |
| `GET /api/auth/discord` | Público | Inicia o login OAuth2. O callback cadastra ou atualiza o perfil Discord e emite o cookie de sessão assinado, válido por 24 horas. |
| `GET /api/status` | Público | Retorna o diagnóstico e, quando autenticado, `sessionUser` com `userId`, `username` e `avatar`. |
| `POST /api/rides` | Sessão Discord | Cadastra a carona e devolve `201` com `ride`. |
| `GET /api/rides` | Público | Devolve `rides` com as caronas do dia em São Paulo, com saída futura e vagas. Para o passageiro autenticado, `reservedRides` inclui as próprias reservas de saídas futuras do dia, inclusive caronas lotadas. Os filtros `origin` e `destination` se aplicam às duas listas. |
| `GET /api/rides/mine` | Sessão Discord | Devolve `rides` cadastradas pelo motorista autenticado, inclusive as lotadas ou passadas. |
| `POST /api/rides/{id}` | Sessão Discord | Confirma uma vaga e devolve `201` com `reservation`. Uma repetição do mesmo passageiro devolve a reserva existente com `200`. |
| `GET /api/rides/{id}` | Motorista da carona | Devolve `passengers` com `user_id`, `username`, `avatar` e `created_at`. |

No cadastro, envie JSON com `origin` e `destination` de até 120 caracteres, `departure_at` em ISO 8601 com fuso explícito e `total_seats` como inteiro de 1 a 8. A resposta normaliza a saída em UTC e inclui `id`, `driver_id` e `available_seats`. A reserva usa a identidade da sessão e dispensa corpo. Os erros da API de caronas usam `{ "ok": false, "error": "codigo" }`, com `400` para entrada inválida, `401` para sessão ausente ou inválida, `403` para reserva do motorista ou origem incompatível, `404` para carona inexistente ou lista de passageiros fora do painel do proprietário e `409` para carona indisponível.

A migração `0002_caronas.sql` deve ser aplicada depois de `0001_init.sql`, inclusive em bancos que já receberam a primeira migração. Para preparar o D1 local, execute `npx.cmd wrangler d1 migrations apply DB --local` na pasta do projeto.
