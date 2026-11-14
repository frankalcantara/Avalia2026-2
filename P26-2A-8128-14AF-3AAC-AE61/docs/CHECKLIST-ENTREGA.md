# Checklist de conformidade e entrega

Chave oficial: `P26-2A-8128-14AF-3AAC-AE61`. Fonte: imagem da atividade e README do repositório oficial consultado em 13/11/2026. Atualização em 14/11/2026 com os relatos do estudante sobre a execução no laboratório e a publicação dos links no AVA. Itens marcados representam verificações observadas ou relatos identificados em `VALIDACAO.md`, não promessa de nota.

| Critério | Pontos | Evidência e situação |
|---|---:|---|
| Publicação Cloudflare e funcionamento pleno (eliminatório) | 25 | Site HTTPS publicado, D1 remoto e login Discord real conferidos. Fluxos de dois participantes aprovados por testes de API locais; estudante confirmou empréstimo e devolução com colega no site publicado. Ensaio manual de troca ainda recomendado. |
| Pages Functions, D1 e Discord OAuth2 | 25 | Implementados e testados no runtime Cloudflare local; autorização Discord real conferida no site publicado. |
| HTML5, CSS3 e JavaScript puro | 15 | Arquivos em public/, sem frameworks; interface conferida no navegador e em largura de celular. |
| Três agentes, um de testes, harness e skills | 25 | Três subagentes efetivamente criados; contribuições em AGENTS.md e skills/. Testes finalizados pelo principal após interrupção dos subagentes. |
| GitHub público, MIT, chave e URLs no AVA | 10 | Código enviado ao fork público; LICENSE MIT e chave no README/rodapé. Pull Request #37 aberto. Estudante informou que publicou os links no comentário da atividade no AVA, cuja configuração informa que não requer envio online. |

## Funcionalidades do projeto 24

- [x] Catálogo comunitário de exemplares físicos técnicos e literários.
- [x] Cadastro vinculado à identidade real importada do Discord.
- [x] Handle Discord para combinar entrega presencial.
- [x] Estados Disponível, Reservado e Emprestado no D1.
- [x] Solicitação de empréstimo por usuário autenticado.
- [x] Aprovação e recusa pelo dono no painel.
- [x] Registro de quem está com o livro e data prevista de devolução.
- [x] Devolução, histórico e liberação do exemplar.
- [x] Troca com reserva dos dois livros e transferência de propriedade.
- [x] Validação e autorização no servidor; proteção contra reserva concorrente.

## Preparação comprovada

- [x] Inicializador oficial executado e chave validada pela API do professor.
- [x] Código desta entrega isolado na subpasta da chave P26.
- [x] Testes automatizados: 27 aprovados, nenhum reprovado.
- [x] Compilação das Pages Functions aprovada.
- [x] Verificação HTTP local das páginas e APIs; escrita anônima rejeitada com 401.
- [x] Banco D1 exclusivo criado e migração inicial aplicada remotamente.
- [x] Fork público existente, derivado de frankalcantara/Avalia2026-2.
- [x] MIT, chave literal no footer e documentação de agentes/skills.

## Fechamento da entrega

- [x] Projeto 0 corrigido e validado: login real e persistência após recarregar. Pasta T26 mantida fora da branch do PR oficial.
- [x] Criar/configurar a aplicação Discord e registrar os redirects corretos.
- [x] Configurar os segredos no Pages e repetir a publicação se necessário.
- [x] Confirmar URL pública acessível por HTTPS e atualizar URL_CLOUDFLARE no README.
- [x] Testar login real com Discord no site publicado.
- [x] Estudante confirmou cadastro, persistência, busca e empréstimo com outra conta real: pedido, reserva, aprovação com data e devolução.
- [x] Confirmar push do código completo para o fork público.
- [x] Executar o validador oficial com o site acessível.
- [x] Pull Request oficial aberto: https://github.com/frankalcantara/Avalia2026-2/pull/37, somente pasta P26.
- [x] Pré-inspeção remota do professor: cinco grupos de requisitos marcados como OK, sem atribuição de nota final.
- [x] URLs publicadas no AVA por comentário na publicação do professor, segundo relato do estudante em 14/11/2026. A atividade informa: "Esta tarefa não requer o envio online". A publicação não foi inspecionada diretamente pelo agente.
- [x] Execução no laboratório com Node.js via Scoop, inicializadores e validadores dos projetos 0 e 24: estudante informou nove itens OK e cópias sem alterações ao final.

## Conferências complementares recomendadas

- [ ] Completar uma troca pela interface com duas contas reais e conferir a transferência dos dois exemplares; a troca já passou nos testes automatizados.
- [ ] Guardar uma captura do comentário no AVA mostrando os links publicados e a identificação da atividade.

O validador oficial faz verificações estruturais e consulta a página pública. Ele não prova sozinho que todas as funcionalidades funcionam, nem que o login foi autorizado por uma pessoa real. O merge é manual pelo professor a partir de 20/11/2026, segundo o README oficial consultado; isso não define por si só o prazo final da disciplina.
