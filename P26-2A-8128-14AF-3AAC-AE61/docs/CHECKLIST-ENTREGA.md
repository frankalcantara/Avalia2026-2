# Checklist de conformidade e entrega

Chave oficial: `P26-2A-8128-14AF-3AAC-AE61`. Fonte: imagem da atividade e README do repositório oficial consultado em 13/11/2026. Itens marcados representam evidências observadas, não promessa de nota.

| Critério | Pontos | Evidência e situação |
|---|---:|---|
| Publicação Cloudflare e funcionamento pleno (eliminatório) | 25 | Site HTTPS publicado, D1 remoto e login Discord real conferidos. Fluxos de dois participantes aprovados por testes de API locais; ensaio com colega recomendado. |
| Pages Functions, D1 e Discord OAuth2 | 25 | Implementados e testados no runtime Cloudflare local; autorização Discord real conferida no site publicado. |
| HTML5, CSS3 e JavaScript puro | 15 | Arquivos em public/, sem frameworks; interface conferida no navegador e em largura de celular. |
| Três agentes, um de testes, harness e skills | 25 | Três subagentes efetivamente criados; contribuições em AGENTS.md e skills/. Testes finalizados pelo principal após interrupção dos subagentes. |
| GitHub público, MIT, chave e URLs no AVA | 10 | Código enviado ao fork público; LICENSE MIT e chave no README/rodapé. Pull Request #37 aberto. A postagem no AVA ainda depende do estudante. |

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

- [x] Projeto 0 corrigido e validado: login real e persistência após recarregar. Pasta T26 mantida fora da branch do PR oficial.
- [x] Criar/configurar a aplicação Discord e registrar os redirects corretos.
- [x] Configurar os segredos no Pages e repetir a publicação se necessário.
- [x] Confirmar URL pública acessível por HTTPS e atualizar URL_CLOUDFLARE no README.
- [x] Testar login real com Discord no site publicado.
- [ ] Ensaio complementar recomendado: percorrer os fluxos da interface com duas contas reais, conforme roteiro.
- [x] Confirmar push do código completo para o fork público.
- [x] Executar o validador oficial com o site acessível.
- [x] Pull Request oficial aberto: https://github.com/frankalcantara/Avalia2026-2/pull/37, somente pasta P26.
- [ ] Postar URLs do projeto e do GitHub no AVA e guardar o comprovante.
- [ ] Se a execução no laboratório com Node.js via Scoop ainda não foi feita, realizá-la no ambiente exigido pelo professor.

O validador oficial faz verificações estruturais e consulta a página pública. Ele não prova sozinho que todas as funcionalidades funcionam, nem que o login foi autorizado por uma pessoa real. O merge é manual pelo professor a partir de 20/11/2026, segundo o README oficial consultado; isso não define por si só o prazo final da disciplina.
