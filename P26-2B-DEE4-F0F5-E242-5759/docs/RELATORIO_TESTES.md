# Auditoria do Projeto #31

**18/11/2026 · Agente 3 · Codex · Node.js 26.13.1**

A rodada final teve **15 verificações executadas, 15 aprovadas e 0 reprovadas**. São oito casos de API e sete verificações no Edge headless. O validador da rubrica foi contado separadamente, com oito itens aprovados e um pendente.

## Reprodução

Execute os dois primeiros comandos na pasta do projeto. Para Chrome, passe o caminho do executável correspondente no segundo comando. O terceiro comando é executado a partir da raiz do repositório.

```powershell
node --test tests/caronas.test.mjs
node tests/navegador.mjs 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node validar-local.mjs P26-2B-DEE4-F0F5-E242-5759
```

A suíte aplica as duas migrações ao SQLite em memória e chama os handlers reais com um adaptador da API D1. O browser usa os arquivos reais de `public/` com servidor HTTP local. O servidor de teste fornece o cookie da fixture ao handler, e o fluxo OAuth2 usa respostas simuladas do Discord. A entrega de cookies sobre HTTPS, a autorização com uma conta Discord e o binding D1 gerenciado dependem do teste no ambiente remoto.

## Casos executados

| Caso | Resultado e evidência |
| --- | --- |
| A1 · Discord OAuth2 e perfil | Passou. Redirecionamento com escopo `identify`, cookie temporário com atributos seguros, rejeição de `state` ausente ou divergente sem chamar o Discord, troca simulada do código, consulta de perfil, limpeza do cookie temporário e perfil retornado em `/api/status`. Erro simulado do provedor gerou redirecionamento de falha. |
| A2 · Sessões e rotas protegidas | Passou. Cinco operações protegidas retornaram 401 para visitantes. Cookies expirados, inválidos e alterados também foram rejeitados e o diagnóstico apresentou sessão nula. |
| A3 · Cadastro e autoria | Passou. Cadastro válido retornou 201 e converteu o horário para UTC. Identidade e contador enviados no corpo foram ignorados. JSON malformado, calendário inválido, horário passado, fuso ausente e vagas inválidas retornaram 400. Origem externa declarada retornou 403. |
| A4 · Busca | Passou. Os dois filtros combinaram apenas a saída elegível, respeitando a virada do dia em Brasília. Caronas passadas, lotadas e do dia seguinte ficaram fora. Texto com sintaxe SQL foi tratado como valor literal e filtro longo retornou 400. |
| A5 · Reserva e capacidade | Passou. Reserva descontou uma vaga e usou a identidade da sessão. Repetição retornou 200 sem descontar novamente. Motorista recebeu 403 e saída passada recebeu 409. Dois pedidos em `Promise.all` para a última vaga resultaram em 201 e 409, uma linha de reserva e zero vagas. A restrição do SQLite reverteu uma inserção direta acima da capacidade. |
| A6 · Autorização de leitura | Passou. Motorista recebeu os IDs dos passageiros confirmados. Outro usuário recebeu 404 e só viu as próprias caronas no painel. Escrita e leitura do diagnóstico respeitaram a identidade da sessão. |
| A7 · Persistência e privacidade | Passou. Nova busca retornou a carona lotada em `reservedRides` apenas para o passageiro confirmado. Visitante e outro usuário receberam listas vazias. A resposta personalizada usou `Cache-Control: no-store`. |
| A8 · Falhas da API | Passou. Binding ausente retornou 503 e falha simulada de banco retornou 500 com código estável e detalhe interno restrito ao log. |
| N1–N5 · Layout | Passaram 320, 480, 768, 1024 e 1440 px de largura por 900 px de altura. O Edge mediu a largura útil sem rolagem horizontal e uma ou duas colunas conforme o breakpoint. |
| N6 · Integração com a interface | Passou. O navegador exibiu o perfil, mostrou texto com marcação HTML literalmente, reservou a última vaga e manteve o cartão confirmado após navegar novamente por recarga. O botão de reserva desapareceu e o banco registrou zero vagas. |
| N7 · Erro no navegador | Passou. Um HTTP 503 simulado na busca foi apresentado como indisponibilidade na página. |

A disputa local usa uma conexão SQLite síncrona, com dois pedidos iniciados juntos. A verificação demonstra o resultado e as invariantes nessa execução. A concorrência entre requisições no Cloudflare deve ser repetida no ambiente publicado. A seleção de handlers por método foi inspecionada no código. O teste local chama os handlers diretamente e a resposta a PUT/PATCH depende do roteamento de Pages em produção.

Na preparação dos testes, duas verificações falharam porque os cookies da fixture foram emitidos antes da ativação do relógio simulado. A primeira rodada do Edge também falhou porque a medição comparava a área útil com a largura total, que inclui a barra de rolagem. Os três problemas estavam nos testes e foram corrigidos antes da rodada final. A checagem `node --check` passou para os scripts da aplicação e dos testes.

## Falhas e gravidade

| Gravidade | Achado | Tratamento |
| --- | --- | --- |
| Média | O frontend guardava a confirmação somente em memória. Ao recarregar, perdia o estado visual. Quando o passageiro ocupava a última vaga, a busca também removia o cartão. | Corrigido com leitura da reserva persistida por sessão e exibição da própria carona lotada. A listagem pública de vagas mantém o contrato anterior. As reservas exibidas são as de partidas futuras do dia que correspondem aos filtros aplicados. |
| Baixa | O `lower()` padrão do SQLite não normaliza maiúsculas acentuadas. `água` deixou de corresponder a `ÁGUA` na verificação independente. | Limitação aberta do filtro. A alteração do comportamento depende de definir a regra de comparação Unicode para os dados já registrados. |
| Bloqueador de entrega | O validador não confirmou a URL pública e o identificador D1 local ainda é provisório. | Pendente de configuração e verificação no Cloudflare. |

## Evidências da rubrica

O comando oficial, executado na raiz do repositório, terminou com código 0. A saída marcou como aprovados MIT, chave no README, chave no rodapé, documento de agentes, agente de teste, skills, frontend Vanilla e estrutura Pages Functions/D1/Discord. A única pendência reportada foi deploy online. A checagem remota do validador consulta o HTML da URL declarada.

| Critério | Peso | Evidência e verificação pendente |
| --- | ---: | --- |
| Deploy online e funcionamento | 25 | Pré-requisito eliminatório pendente. Verificar a URL real e executar autenticação, gravação, leitura e disputa da última vaga remotamente. |
| Arquitetura, D1 e Discord OAuth2 | 25 | Estrutura e contratos verificados localmente. Validar binding `DB`, aplicação das migrações e OAuth2 com Discord real. |
| Frontend Vanilla | 15 | HTML5, CSS3 e JavaScript puro verificados, com DOM real no Edge e cinco larguras. |
| Engenharia de agentes | 25 | Há três skills e três sessões Codex verificáveis na rodada de auditoria. As etapas de implementação dos Agentes 1 e 2 possuem descrições, mas a documentação disponível não contém identificadores das sessões históricas. A aprovação por regex do validador confirma apenas a presença das seções. |
| Repositório público, MIT e auditoria | 10 | MIT, chaves e estrutura verificados. Na inspeção, `git ls-files -- .` estava vazio na pasta oficial. Publicação desta versão em repositório público, visibilidade do remoto e entrega das URLs no AVA seguem sem confirmação. |

Para concluir a verificação remota, configure o identificador D1 e o binding `DB`, aplique as migrações, configure as variáveis de ambiente e registre a URL exata do callback no Discord. Confirme a URL de produção no README, valide o fluxo remoto com contas distintas e execute novamente o validador oficial. As etapas de publicação e entrega ficam fora desta auditoria.
