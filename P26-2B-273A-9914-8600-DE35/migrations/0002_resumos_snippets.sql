-- Projeto #19 — Repositorio de Resumos e Snippets da Turma
-- P26-2B-273A-9914-8600-DE35
--
-- A migration 0001 (gerada pelo iniciar.mjs) ja criou `discord_users`, que
-- serve como tabela de usuarios: a chave e o `user_id` do Discord, que e
-- estavel e nao muda quando a pessoa troca o nome de usuario.
--
-- Esta migration adiciona o modelo do projeto propriamente dito.
-- Forward-only: para corrigir algo aqui, crie a proxima numerada.

-- ---------------------------------------------------------------------------
-- Publicacoes: os resumos teoricos e os trechos de codigo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publicacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,

  -- O autor vem SEMPRE da sessao verificada no servidor, nunca de um campo
  -- que o navegador enviou. Esta coluna existe para guardar quem o servidor
  -- identificou, nao para o cliente declarar quem ele e.
  autor_id    TEXT    NOT NULL REFERENCES discord_users (user_id),

  tipo        TEXT    NOT NULL CHECK (tipo IN ('resumo', 'snippet')),
  titulo      TEXT    NOT NULL,
  conteudo    TEXT    NOT NULL,

  -- Categoria e a materia ou a linguagem, conforme o enunciado pede
  -- ("categorizado por linguagem ou materia"). Lista fechada validada na
  -- Function: CHECK aqui engessaria a lista no banco, e mexer nela exigiria
  -- uma migration nova a cada materia nova do semestre.
  categoria   TEXT    NOT NULL,

  criado_em   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publicacoes_categoria ON publicacoes (categoria);
CREATE INDEX IF NOT EXISTS idx_publicacoes_autor     ON publicacoes (autor_id);

-- ---------------------------------------------------------------------------
-- Votos: um voto por usuario por publicacao.
-- ---------------------------------------------------------------------------
--
-- A restricao de unicidade exigida pelo enunciado esta AQUI, no banco, e nao
-- na interface. Esconder o botao depois de votar e cortesia com o usuario; o
-- que impede o voto duplo e esta linha.
--
-- A diferenca importa porque qualquer pessoa pode chamar o endpoint
-- diretamente, por fora da tela. Com a restricao no banco, o segundo voto
-- falha mesmo que todas as camadas acima tenham errado.
--
CREATE TABLE IF NOT EXISTS votos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  publicacao_id  INTEGER NOT NULL REFERENCES publicacoes (id) ON DELETE CASCADE,
  usuario_id     TEXT    NOT NULL REFERENCES discord_users (user_id),
  criado_em      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (publicacao_id, usuario_id)
);

-- A listagem principal ordena pelos mais votados, entao contar votos por
-- publicacao e o caminho mais percorrido da aplicacao.
CREATE INDEX IF NOT EXISTS idx_votos_publicacao ON votos (publicacao_id);

-- ---------------------------------------------------------------------------
-- Decisao de modelagem registrada: contagem calculada, nao armazenada.
-- ---------------------------------------------------------------------------
--
-- Havia duas opcoes para ordenar pelos mais votados:
--
--   (a) guardar uma coluna `total_votos` em `publicacoes` e atualizar a cada
--       voto — leitura mais rapida, porem dois lugares para manter em
--       sincronia, e toda contagem errada de sistema nasce desse desencontro;
--   (b) contar na consulta com LEFT JOIN + COUNT, apoiado no indice acima.
--
-- Escolhida a (b). Num repositorio de turma o volume nao justifica o risco da
-- desnormalizacao. Se um dia a listagem ficar lenta, a troca e local: muda a
-- consulta, nao o modelo.
--
-- A view abaixo deixa a consulta de listagem num lugar so, para a Function nao
-- repetir o JOIN em cada endpoint.
CREATE VIEW IF NOT EXISTS publicacoes_com_votos AS
SELECT
  p.id,
  p.autor_id,
  p.tipo,
  p.titulo,
  p.conteudo,
  p.categoria,
  p.criado_em,
  u.username   AS autor_nome,
  u.avatar     AS autor_avatar,
  COUNT(v.id)  AS total_votos
FROM publicacoes p
JOIN discord_users u ON u.user_id = p.autor_id
LEFT JOIN votos v    ON v.publicacao_id = p.id
GROUP BY p.id;
