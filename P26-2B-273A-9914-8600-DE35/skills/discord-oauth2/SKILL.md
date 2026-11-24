# SKILL — Login com Discord OAuth2 em Cloudflare Pages Functions

Procedimento usado pelo **Agente 3 (Autenticação Discord OAuth2)** neste
projeto. Escrito **depois** de executar o fluxo de ponta a ponta, não a partir
da documentação — por isso registra as armadilhas reais, e não apenas o
caminho feliz.

## Quando usar

Projeto que precisa de login com Discord, rodando em Cloudflare Pages
Functions, com persistência em D1.

## Regra de segredos (vale o procedimento inteiro)

O Client Secret nunca entra em arquivo versionado, em log, em mensagem de erro
ou em conversa. O agente escreve o **nome** da variável
(`env.DISCORD_CLIENT_SECRET`), nunca o valor. Quando o portal do Discord exibe
o segredo, o agente não lê a tela: quem copia é a pessoa.

O Client ID é público — aparece na URL de autorização que o navegador monta.

## O que difere do Google OAuth2

Esta é a diferença que derruba quem adapta um tutorial do Google:

**O Discord não devolve `id_token`.** A troca do código retorna apenas
`access_token`. Descobrir quem entrou exige uma **segunda chamada**:

```
GET https://discord.com/api/v10/users/@me
Authorization: Bearer <access_token>
```

No Google, o `id_token` já traz o usuário e uma chamada basta.

## Passo a passo

### 1. Criar a aplicação — exige uma pessoa

`https://discord.com/developers/applications` → New Application.

O aceite dos Termos de Serviço do Desenvolvedor é um contrato: quem marca é a
pessoa, não o agente.

### 2. Cadastrar os redirects

Em OAuth2 → Redirects, um por ambiente:

```
https://<projeto>.pages.dev/api/auth/discord/callback
http://localhost:8788/api/auth/discord/callback
```

O Discord **não pede origens JavaScript** — só redirects. Um campo a menos que
no Google.

`8788` é a porta do `wrangler pages dev`. Cadastrar o local é o que permite
testar sem publicar a cada tentativa.

Deixe **"Cliente público" desligado**: ligado, o Discord trata o app como
incapaz de guardar segredo, o que não é o caso de um app com servidor.

### 3. Client Secret

No portal, ele aparece como "Oculto por segurança". Se o botão de copiar não
devolver o valor, use **Redefinir segredo** — inofensivo enquanto nada usa o
segredo ainda; depois do login funcionando, redefinir derruba o login até os
dois ambientes serem atualizados.

Guarde em variável de ambiente do sistema, **não em arquivo no projeto**. Use
prefixo por projeto (`RESUMOS_DISCORD_CLIENT_SECRET`) para não colidir com
outro trabalho na mesma máquina; o código usa o nome genérico e a tradução
acontece no comando de desenvolvimento:

```
npx wrangler pages dev --binding DISCORD_CLIENT_SECRET="$RESUMOS_DISCORD_CLIENT_SECRET" --binding SESSION_SECRET="$RESUMOS_SESSION_SECRET"
```

Em produção, por stdin, para o valor não passar pela linha de comando:

```
echo -n "$RESUMOS_DISCORD_CLIENT_SECRET" | npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name <projeto>
```

Segredo do Pages só vale **a partir do próximo deploy**.

### 4. Autorização

```
https://discord.com/oauth2/authorize
  ?client_id=<id>
  &redirect_uri=<origem>/api/auth/discord/callback
  &response_type=code
  &scope=identify
  &state=<aleatório>
```

`identify` basta: devolve `id`, `username`, `global_name` e `avatar`. Não peça
`email` sem necessidade — todo escopo a mais é dado pessoal sob sua
responsabilidade.

O `state` é **opcional para o Discord** e a documentação recomenda. Use: sem
ele, um site hostil consegue induzir o navegador da vítima a concluir um login
com a conta do atacante.

### 5. Troca do código

```
POST https://discord.com/api/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=...&redirect_uri=...&client_id=...&client_secret=...
```

**JSON é rejeitado neste endpoint.** A documentação é explícita.

### 6. Perfil

`GET https://discord.com/api/v10/users/@me` com `Authorization: Bearer`.

O Discord pede um `User-Agent` próprio nas chamadas à API HTTP e pode recusar
requisições sem ele.

Campos: `id` (string), `username` (handle), `global_name` (nome de exibição,
pode ser nulo), `avatar` (hash, pode ser nulo).

### 7. Avatar

**Vem como hash, não como URL.** Monte:

```
https://cdn.discordapp.com/avatars/{id}/{hash}.png
```

Hash começando com `a_` é animado — peça `.gif` ou `.webp`.

Quando `avatar` é nulo, o avatar padrão vem de:

```
https://cdn.discordapp.com/embed/avatars/{(BigInt(id) >> 22n) % 6n}.png
```

O deslocamento de bits exige `BigInt`: ids do Discord passam de
`Number.MAX_SAFE_INTEGER`.

### 8. Sessão

Cookie assinado com HMAC-SHA256 via WebCrypto, `HttpOnly`, `SameSite=Lax`,
`Secure` em HTTPS, com expiração explícita. O cookie **não é criptografado**:
só pode conter o que é público — id do usuário e validade.

Verifique a assinatura com `crypto.subtle.verify`, que compara em tempo
constante. Comparar com `===` permitiria descobrir a assinatura byte a byte
medindo o tempo de resposta.

A chave do usuário no banco é o **`id` do Discord**, nunca o nome: `username` e
`global_name` mudam quando a pessoa troca o apelido, e a autoria de tudo o que
ela publicou iria junto.

O endpoint de logout é **POST, não GET**: com GET, uma tag `<img>` em qualquer
site desloga quem visitar a página.

## Como saber que funcionou

Chegar na tela inicial depois de autorizar **não prova nada** — o redirect
acontece mesmo sem sessão criada. A prova é um endpoint que responda quem você
é numa requisição seguinte (`GET /api/auth/eu`), devolvendo id, nome e a URL do
avatar.

Teste nos dois ambientes. `localhost` e `127.0.0.1` são endereços **diferentes**
para o provedor: ele compara como texto e não resolve nomes. Entrar pelo
endereço não cadastrado dá `redirect_uri_mismatch`.
