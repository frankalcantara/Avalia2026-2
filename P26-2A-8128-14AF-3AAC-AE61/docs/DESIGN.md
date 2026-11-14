# Direção visual e execução da interface

## Plano anterior à implementação

EntreLivros é uma estante comunitária universitária. A interface dá prioridade a encontrar um livro, identificar seu proprietário e acompanhar a circulação do exemplar físico.

- **Paleta:** papel branco `#FFFFFF`, fundo azul muito claro `#F4F7FC`, texto azul `#1B2B47`, ação índigo `#3B49AC`, verde de disponibilidade `#20614F`, lilás de apoio `#EAE9FB`.
- **Tipografia:** Georgia nos títulos editoriais e nas capas tipográficas; Segoe UI/Arial nos controles e no texto funcional. Fontes locais, sem chamada externa.
- **Layout:** cabeçalho compacto, apresentação da comunidade com pequena estante desenhada em CSS, navegação principal, ferramentas de busca e grade de livros. Texto alinhado à esquerda, largura limitada.
- **Princípio particular:** capas tipográficas geradas com os dados reais dos livros. Não usar imagens falsas de capas nem acervos fictícios. As três condições do exemplar e as modalidades de circulação ficam legíveis.

```text
marca EntreLivros                          perfil / entrar
Livros que circulam.                       desenho de estante
Conhecimento que fica.                     sem dados de acervo
Catálogo | Meus livros | Pedidos
Busca por título/autor     filtros
livro + condição + dono    livro          livro
```

## Revisão do plano contra o enunciado

O centro da página é o catálogo, com aparência de biblioteca comunitária, sem métricas inventadas ou cartões promocionais. O tema visual não introduz funcionalidades alheias ao pedido. Todo gerenciamento usa DOM nativo, formulários semânticos e diálogos nativos. O mesmo fluxo atende celular e computador. A única identidade de acesso é a fornecida pelo Discord.

## Implementação realizada

Implementados catálogo, filtros, cadastro/edição/remoção de exemplares, painel de pedidos, diálogos de empréstimo/troca, aprovação com data, devolução, conclusão de troca e identificação Discord. Conferência visual em navegador local: catálogo vazio, busca sem resultado, limpar filtros, Meus livros sem sessão e exigência de login. Largura de celular sem rolagem horizontal; console sem erros observados. Capturas em docs/imagens/. Os fluxos autenticados foram testados pela API; o login real no site publicado e a validação de campo obrigatório no formulário de cadastro também foram conferidos. Os fluxos de dois participantes não foram conferidos visualmente de ponta a ponta.
