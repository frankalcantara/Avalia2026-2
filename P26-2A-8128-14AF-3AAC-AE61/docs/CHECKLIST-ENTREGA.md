# Checklist de conformidade e entrega

Chave oficial: `P26-2A-8128-14AF-3AAC-AE61`. Fonte: imagem da atividade e README do repositório oficial consultado em 13/11/2026. Itens marcados representam evidências observadas, não promessa de nota.

| Critério | Pontos | Evidência e situação |
|---|---:|---|
| Publicação Cloudflare e funcionamento pleno (eliminatório) | 25 | D1 remoto criado e migração aplicada. Publicação e login real em verificação; não declarar concluído enquanto houver pendências. |
| Pages Functions, D1 e Discord OAuth2 | 25 | Implementados e testados em runtime local; autorização Discord externa depende de configurar a aplicação. |
| HTML5, CSS3 e JavaScript puro | 15 | Arquivos em public/, sem frameworks; interface conferida no navegador e em largura de celular. |
| Três agentes, um de testes, harness e skills | 25 | Três subagentes efetivamente criados; contribuições em AGENTS.md e skills/. Testes finalizados pelo principal após interrupção dos subagentes. |
| GitHub público, MIT, chave e URLs no AVA | 10 | Fork público existente, LICENSE MIT e chave no README/rodapé. Push, PR e AVA precisam de comprovação separada. |

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

## Fechamento obrigatório

- [ ] Confirmar Projeto 0: a publicação antiga da chave T26-2A-2FDD-6CD3-97B0-E36E está com falha. Corrigir e testar sem incluir a pasta T26 no PR oficial.
- [ ] Criar/configurar a aplicação Discord e registrar os redirects corretos.
- [ ] Configurar os segredos no Pages e repetir a publicação se necessário.
- [ ] Confirmar URL pública acessível por HTTPS e atualizar URL_CLOUDFLARE no README.
- [ ] Testar login real com Discord e fluxo entre duas contas no site publicado.
- [ ] Confirmar push do código completo para o fork público.
- [ ] Executar o validador oficial com o site acessível.
- [ ] Abrir Pull Request para o repositório do professor contendo apenas a pasta P26.
- [ ] Postar URLs do projeto e do GitHub no AVA e guardar o comprovante.
- [ ] Se a execução no laboratório com Node.js via Scoop ainda não foi feita, realizá-la no ambiente exigido pelo professor.

O validador oficial faz verificações estruturais e consulta a página pública. Ele não prova sozinho que todas as funcionalidades funcionam, nem que o login foi autorizado por uma pessoa real. O merge é manual pelo professor a partir de 20/11/2026, segundo o README oficial consultado; isso não define por si só o prazo final da disciplina.
