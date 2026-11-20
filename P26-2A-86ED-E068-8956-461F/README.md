# Quadro de Caronas Universitárias

**Projeto #31. Turma 2A.**
Aluno: Guilherme Cracco Lichtenfels. RA: 2026107839.

**Chave Única Oficial (Hash): `P26-2A-86ED-E068-8956-461F`**

Sistema de caronas solidárias entre estudantes que vão para o campus. Quem tem carro cadastra uma rota (bairro de origem, destino, horário e vagas livres). Quem precisa de transporte filtra as rotas do dia e reserva uma vaga. O motorista vê os passageiros confirmados, com o identificador do Discord de cada um, e combina o ponto de encontro.

## Links da entrega

- Projeto online: https://caronas-cracco.pages.dev
- Repositório: https://github.com/guicracco/Avalia2026-2

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks |
| Backend | Cloudflare Pages Functions (`functions/`) |
| Banco | Cloudflare D1 (SQLite), binding `DB` |
| Login | OAuth2 do Discord (escopo `identify`): user_id, nome de usuário e avatar |

## Funcionalidades

- Login obrigatório com Discord.
- Motorista cadastra rota: bairro de origem, destino, data, horário de saída e vagas livres (1 a 8).
- Passageiro filtra rotas ativas do dia por data, origem e destino e reserva uma vaga.
- Reserva atômica: o servidor registra a reserva e decrementa `vagas_livres` na mesma transação do D1. A restrição `CHECK (vagas_livres >= 0)` impede vender a mesma vaga duas vezes, mesmo com requisições simultâneas.
- Painel do motorista lista os passageiros confirmados com nome, @usuário e ID do Discord, com atalho para abrir o perfil.
- Passageiro vê suas reservas, fala com o motorista pelo Discord e pode cancelar (a vaga volta).
- Motorista pode cancelar a rota.

## Regras validadas no servidor

- Sessão obrigatória em todas as rotas de dados (401 sem login).
- Origem e destino com 2 a 60 caracteres e diferentes entre si.
- Data existente, horário HH:MM, saída no futuro (fuso America/Sao_Paulo) e no máximo 60 dias à frente.
- Vagas inteiras de 1 a 8.
- Máximo de 10 rotas ativas por motorista.
- Motorista não reserva a própria rota; não há reserva duplicada; rota cancelada ou que já saiu não aceita reserva.
- Somente o dono cancela a rota.
- POSTs/DELETEs com cabeçalho `Origin` de outro site são recusados (403).
- Consultas SQL parametrizadas. Sessão em cookie `HttpOnly; Secure; SameSite=Lax`, com apenas o hash do token no banco.

## API

| Método e caminho | Função |
|---|---|
| GET `/api/auth/login` | Inicia o login no Discord |
| GET `/api/auth/callback` | Conclui o login e cria a sessão |
| POST `/api/auth/logout` | Encerra a sessão |
| GET `/api/me` | Usuário logado |
| GET `/api/rotas?data=&origem=&destino=` | Rotas ativas do dia |
| POST `/api/rotas` | Cadastra rota |
| DELETE `/api/rotas/:id` | Cancela rota (dono) |
| POST `/api/rotas/:id/reservar` | Reserva vaga (atômico) |
| DELETE `/api/rotas/:id/reservar` | Cancela a reserva |
| GET `/api/minhas-rotas` | Painel do motorista com passageiros |
| GET `/api/minhas-reservas` | Reservas do passageiro |

## Como publicar

1. Crie o banco D1 e rode `schema.sql` no console dele.
2. No Cloudflare Pages, conecte o repositório. Pasta raiz: a pasta deste projeto. Comando de build: nenhum. Diretório de saída: `public`.
3. Em Settings, Bindings: adicione D1 com nome de variável `DB`.
4. Em Settings, Variables and Secrets: `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (secret).
5. No Discord Developer Portal, em OAuth2, cadastre o redirect `https://caronas-cracco.pages.dev/api/auth/callback`.
6. Faça um novo deploy para as variáveis valerem.

## Testes

```
npm test
npm test -- https://caronas-cracco.pages.dev
```

## Agentes, harness e skills

Veja [AGENTES.md](AGENTES.md). Três agentes (arquiteto-backend, construtor-frontend e testador-validador, este dedicado a teste e validação) em `.claude/agents/`, com os skills em `.claude/skills/`.

## Licença

MIT. Veja [LICENSE](LICENSE).
