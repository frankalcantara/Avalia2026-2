# Harness de implementação e validação

Este projeto organiza o trabalho em três funções documentadas em `agents/`. O fluxo é sequencial: backend e persistência primeiro, interface depois e validação por último. Se uma validação falhar, o item volta à função responsável; a publicação só ocorre depois de corrigido e validado.

## Etapas

1. **Arquiteto/Backend** — define o schema D1, a configuração Wrangler, as Functions OAuth e as rotas de transações. A validação de dados e a autorização baseada no ID da sessão são responsabilidades do servidor.
2. **Construtor Frontend** — implementa a interface sem frameworks e integra login, filtros, saldo, formulário, CRUD e gráfico de barras em elementos `div`.
3. **Testador/Validador** — executa verificações estáticas e locais, confere os requisitos da checklist e registra cada resultado em `RELATORIO_TESTE.md`. Uma falha bloqueia a publicação e é encaminhada à etapa correspondente.
4. **Publicação** — após aprovação local, o responsável configura os recursos e segredos no Cloudflare, publica e repete os testes na URL HTTPS. Em seguida, prepara a pasta de entrega no fork oficial e abre o Pull Request.

## Critérios de passagem

- Backend: dados validados no servidor, consultas sempre limitadas a `user_id` da sessão, token OAuth e cookies assinados sem segredos no código.
- Frontend: cliente Vanilla JS, dados inseridos com `textContent`, filtros e CRUD funcionais, gráfico apenas com `div`/CSS e leiaute responsivo.
- Testes: verificar schema, sintaxe, autorização sem sessão e recursos publicados; resultados de conta/deploy indisponíveis devem continuar explicitamente pendentes e não podem ser aprovados por suposição.

## Skills de apoio

- `ambiente-fallback`: diagnóstico de Node, npm, Git, Wrangler e caminhos alternativos.
- `discord-oauth`: fluxo OAuth, validação do state e sessão Discord.
- `d1-crud`: persistência, isolamento e validação das transações.
- `cloudflare-deploy`: publicação e configuração dos recursos Cloudflare.
- `grafico-div-css`: visualização proporcional sem bibliotecas ou SVG/canvas.
- `teste-validacao`: checklist e registro rastreável dos resultados.
