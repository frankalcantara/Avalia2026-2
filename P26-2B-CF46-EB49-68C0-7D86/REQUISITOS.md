# Projeto #23 — Gerador e Organizador de Referências Bibliográficas

O sistema permite que uma pessoa autenticada crie projetos, registre fontes, gere referências em ABNT ou IEEE e copie a bibliografia compilada de um projeto.

## Interface e bibliografia

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | Implementar a interface em HTML5, CSS3 e JavaScript puro, sem frameworks. | A interface publicada funciona no navegador e manipula o DOM com APIs nativas. |
| RF-02 | Aceitar livro, artigo de periódico e página web. | O formulário alterna entre os três tipos e apresenta os campos pertinentes a cada fonte. |
| RF-03 | Coletar autor, título, ano e veículo de publicação. | O formulário identifica os campos e sinaliza os obrigatórios. O veículo corresponde à editora do livro, ao periódico do artigo ou ao site da página web. Os campos complementares dependem do tipo e da norma. |
| RF-04 | Gerar referências em ABNT e IEEE para os três tipos de fonte. | As seis combinações têm exemplos de referência verificados, incluindo ordem dos elementos, pontuação, caixa alta e grifo conforme a norma aplicável. |
| RF-05 | Criar projetos, salvar referências e organizá-las por projeto. | O usuário autenticado consegue criar e reabrir um projeto, consultar as referências salvas e atualizar sua coleção. Os dados persistem entre sessões e ficam restritos ao usuário autorizado. |
| RF-06 | Compilar a bibliografia completa do projeto em ordem alfabética rigorosa. | A lista usa um critério de ordenação documentado e reproduzível. Os testes cobrem acentos, diferenças de caixa, autoria ausente e empates. A regra deve explicitar como a numeração IEEE se relaciona com a ordem alfabética exigida. |
| RF-07 | Copiar a bibliografia completa. | Uma ação copia todas as referências do projeto na ordem compilada, com quebras de linha e pontuação preservadas. A interface indica o resultado da cópia. O comportamento do grifo no conteúdo copiado deve constar do contrato de saída. |

## Autenticação, backend e dados

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RT-01 | Exigir login Discord OAuth2 para usar o sistema e obter ID, nome e avatar do usuário. | O login cria uma sessão válida vinculada ao ID do Discord. O perfil usa nome e avatar fornecidos pelo Discord e as operações protegidas exigem sessão. A página pública permite iniciar o login. |
| RT-02 | Usar Cloudflare Pages Functions para o backend e a validação no servidor. | Os endpoints validam dados e permissões independentemente da interface, rejeitam entradas inválidas e restringem o acesso a projetos e referências aos usuários autorizados. Segredos OAuth ficam nas configurações privadas do ambiente. |
| RT-03 | Usar Cloudflare D1 para usuários, projetos e referências. | Migrações versionadas criam o esquema relacional. Testes confirmam persistência e vínculo entre usuário, projeto e referência. |

## Publicação, agentes e entrega acadêmica

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RE-01 | Publicar o site na Cloudflare. | A URL pública responde por HTTPS e permite concluir o fluxo de login, criação de projeto, gravação e cópia da bibliografia. |
| RE-02 | Manter o código em repositório público no GitHub com licença MIT. | A URL do repositório abre sem autenticação e a entrega contém o arquivo `LICENSE` com a licença MIT. |
| RE-03 | Usar pelo menos três agentes distintos, incluindo um de teste e validação. | A documentação identifica os agentes, responsabilidades, skills e o harness utilizado. O histórico registra tarefas e resultados de execuções reais. |
| RE-04 | Incluir a chave `P26-2B-CF46-EB49-68C0-7D86` no `README.md` do projeto e no rodapé do site. | A mesma chave aparece nos dois locais e o README registra a URL pública em `URL_CLOUDFLARE`. |
| RE-05 | Criar um fork público do repositório oficial e preparar a pasta no laboratório. | Na raiz do fork, executar `node iniciar.mjs P26-2B-CF46-EB49-68C0-7D86` no laboratório e manter a entrega dentro da subpasta gerada com a chave. |
| RE-06 | Validar a pasta e abrir um Pull Request para o repositório oficial. | Executar `node validar-local.mjs P26-2B-CF46-EB49-68C0-7D86` antes do PR. O PR contém apenas a pasta do projeto. |
| RE-07 | Entregar as URLs do site e do repositório GitHub no AVA. | O envio no AVA contém a URL pública HTTPS e a URL do repositório público. |

A estrutura oficial da pasta de entrega inclui `public/`, `functions/`, `migrations/`, `AGENTS.md`, `skills/`, `LICENSE` e `README.md`. A estrutura do workspace de desenvolvimento deve ser conciliada com ela antes da validação final. [Instruções oficiais de entrega do Avalia2026-2](https://github.com/frankalcantara/Avalia2026-2#-etapa-2-entrega-do-projeto-oficial-sorteado-valendo-100-pontos--chave-p26-).
