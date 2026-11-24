# Projeto #14: Diário de Bordo de Projetos

- **Modalidade:** Projeto Oficial Sorteado (valendo 100 pontos)
- **Estudante:** Nicoly Ribeiro Barbosa
- **Turma:** 2B
- **Chave Única:** `P26-2B-40B7-5F3D-00B9-E1D2`
- **URL_CLOUDFLARE:** `https://diario-de-bordo-k6c.pages.dev`
- **Repositório:** https://github.com/Nicaribeiro/Diario_de_Bordo
- **Licença:** MIT

---

## O que é

Um diário (logbook) para registrar, dia a dia, o avanço de um projeto de engenharia.
Cada pessoa entra com a conta do Discord e vê **apenas as suas** entradas. Cada entrada
tem um texto e um **nível de impedimento técnico** (sem impedimento, baixo, médio ou
crítico), e aparece numa **linha do tempo vertical** feita em CSS. Também é possível buscar
entradas antigas por palavra-chave ou por intervalo de datas.

## Como usar

1. Acesse a URL acima e clique em **Entrar com Discord**.
2. Escreva o que aconteceu, escolha o nível de impedimento e clique em **Registrar**.
3. Use **Buscar** para filtrar por palavra-chave e/ou datas (De / Até).
4. Clique em **Sair** para encerrar a sessão.

## Tecnologias

- **Frontend:** HTML5, CSS3 e JavaScript puro (sem frameworks nem bibliotecas externas).
- **Backend:** Cloudflare Pages Functions (serverless).
- **Banco de dados:** Cloudflare D1 (SQLite).
- **Login:** exclusivamente Discord OAuth2 (importa `user_id`, nome e avatar).

## Como a segurança é feita no servidor

- **Autoria vem da sessão:** o dono de cada entrada é o `userId` do cookie assinado, nunca
  um valor enviado pelo navegador.
- **Diário privado:** toda consulta filtra por `user_id`.
- **Data não é adulterável:** `created_at` é carimbado pelo banco, em UTC, no momento da
  inserção. A API não aceita data enviada pelo cliente.
- **Login protegido:** o parâmetro `state` é gerado a cada tentativa e conferido na volta
  (proteção contra login forjado).
- **Cookie de sessão assinado:** HMAC-SHA256 com segredo guardado no Cloudflare, validade
  de 24 horas, `HttpOnly` e `Secure`.
- **Validação de entrada:** o nível de impedimento é validado no servidor e também por um
  `CHECK` no banco.
- **SQL parametrizado:** todos os valores entram com `?` e `.bind()`, evitando injeção de SQL.
- **Texto seguro na tela:** as entradas são inseridas com `textContent`, nunca como HTML.

## Rotas da API

| Rota | Método | O que faz |
|---|---|---|
| `/api/auth/discord` | GET | Inicia o login no Discord (gera o `state`) |
| `/api/auth/discord/callback` | GET | Confere o `state`, busca o perfil e cria a sessão |
| `/api/auth/logout` | POST | Encerra a sessão |
| `/api/entradas` | POST | Cria uma entrada (exige login) |
| `/api/entradas?q=&de=&ate=` | GET | Lista e busca as entradas do usuário logado |
| `/api/status` | GET | Diagnóstico e sessão atual |

## Estrutura

```
functions/api/        rotas serverless (auth, entradas, status)
lib/session.js        assinatura e verificação do cookie de sessão
migrations/           esquema do banco D1 (0001 e 0002_entradas)
public/               interface (index.html, styles.css, app.js)
skills/               skills usadas pelos agentes
AGENTS.md             agentes, harness e skills
```

## Agentes de IA

Os agentes, o ambiente em que atuaram e as skills estão descritos em [AGENTS.md](./AGENTS.md).

## Configuração (segredos)

O projeto usa três segredos no Cloudflare Pages (**Settings > Variables and secrets**):
`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET`, além do binding `DB`
apontando para o banco D1. **Nenhum segredo está neste repositório.**