# Validação independente — Projeto #39

Chave: `P26-2A-DE92-BEA1-D95B-F329`

Data: 14/11/2026

Agente responsável: `/root/qa`, executado no harness Codex em ChatGPT Work.

## Ambiente e método

- Node.js v24.22.1, `node:test` e `node:sqlite`, sem bibliotecas de testes externas.
- `tests/d1-adapter.mjs` implementa a interface usada do D1 sobre um banco SQLite real em memória, com chaves estrangeiras habilitadas e lotes transacionais.
- As rotas Cloudflare Pages Functions são importadas diretamente e chamadas com `Request`/`Response` nativos. O teste não substitui os validadores de negócio por stubs.
- Apenas as chamadas externas ao Discord são substituídas por respostas controladas: troca do código OAuth2 e consulta a `/users/@me`. Nenhuma credencial real ou rede externa é usada na suíte.
- Cada caso começa com um banco vazio e aplica os arquivos SQL versionados em `migrations/`.

## Execução

Na pasta do projeto:

```bash
node --test tests/backend.test.mjs
```

Na raiz do repositório oficial:

```bash
node validar-local.mjs P26-2A-DE92-BEA1-D95B-F329
```

## Escopo dos testes de integração

| Área | Verificação |
| --- | --- |
| Visitantes anônimos | Ausência de sessão e bloqueio de leitura privada/escrita/logout |
| OAuth2 | Redirecionamento, escopo `identify`, state, troca de token e consulta real da identidade no contrato do Discord |
| Sessão | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; assinatura não forjável; logout revogável; expiração e cookie adulterado |
| Autorização | Identidade derivada da sessão; tentativa de forjar proprietário não altera outro currículo |
| Persistência | Perfil, formação, experiência, projetos, habilidades e links sobrevivem ao ciclo de gravação/leitura em SQLite |
| Capacidade D1 | 125 entradas estruturadas persistidas; comandos com até 100 parâmetros e orçamento de consultas abaixo de 40 na gravação |
| Privacidade | Rascunho não é público; publicação habilita leitura; despublicação a revoga |
| CSRF | Ausência/token incorreto e Origin externo bloqueiam mutações |
| Validação | Nome inválido, tipos incorretos, tema não permitido e URLs executáveis são rejeitados |
| Robustez | JSON inválido e corpo excessivo não sobrescrevem os dados persistidos |
| SQL | Caracteres de SQL permanecem como texto, sem executar comandos |
| Integridade relacional | Exclusão de usuário propaga por chave estrangeira para sessões, currículo e coleções |
| Diagnóstico | Endpoint de status não divulga usuários, sessões ou segredos |

## Estado das verificações

Resultado executado em 14/11/2026: **17 testes aprovados, 0 falhas, 0 ignorados**. Comando: `node --test tests/backend.test.mjs`. As rotas reais e os validadores do backend foram executados sobre as migrações versionadas. Última execução concluída com código de saída `0`.

O cenário de capacidade máxima grava e recupera **20 formações, 20 experiências, 20 projetos, 50 habilidades e 15 links**, com textos curtos. O teste inspeciona o número de parâmetros vinculados por comando e o número de comandos emitidos na gravação.

Validador estrutural oficial executado: **8 itens aprovados e 1 pendente**, referente à publicação online no Cloudflare. Licença, chave no README e rodapé, documentação de agentes, agente de validação, skills, frontend vanilla e estrutura de Functions/D1/Discord foram reconhecidos. O validador retorna código de saída `0` mesmo com esse item pendente; a contagem do relatório é a evidência relevante.

Checagem de sintaxe de `public/app.js`, `functions/_lib.js`, `functions/api/curriculum.js` e `functions/api/auth/discord/callback.js`: aprovada. Inspeção do HTML não encontrou IDs duplicados nem elementos `label` apontando para IDs inexistentes. Inspeção do código da interface identificou preenchimento de conteúdo por `textContent`, links com protocolos filtrados, consentimento visível para publicação e presença de regras de impressão.

Verificação adicional pelo coordenador: migração D1 aplicada localmente pelo Wrangler, com 13 comandos executados com sucesso. A interface foi aberta no navegador em prévia estática: exemplo, edição do nome, atualização em tempo real, alternância dos três temas, inclusão e remoção de projeto e bloqueio de salvamento anônimo foram observados. A prévia estática não fornece API; o erro de conexão nessa prévia é esperado e não comprova falha do backend.

A prévia integrada com o runtime local de Workers não iniciou neste ambiente devido ao erro de sistema `uv_interface_addresses`; a compilação das Functions e os testes de integração passaram separadamente. Não foram alteradas permissões de rede nem o runtime para contornar essa limitação.

**Este resultado local não declara o projeto publicado nem o OAuth2 real configurado.** Login real, D1 remoto, inspeção móvel e exportação PDF final permanecem pendentes.

## Limites

- O adaptador usa SQLite local e reproduz as operações usadas pela aplicação; ele não comprova a configuração do binding de um banco D1 remoto nem aspectos operacionais da infraestrutura Cloudflare.
- As respostas do Discord nos testes são controladas. Um login OAuth2 com uma conta Discord real deve ser verificado no endereço publicado, com Client ID, Client Secret e redirect URI configurados.
- O validador fornecido pelo professor verifica estrutura e disponibilidade HTTP da URL, mas não substitui testes de autorização, persistência, interface ou autenticação real.
- Inspeção visual em navegador, impressão PDF e experiência móvel são executadas separadamente pelo agente coordenador. Não foram declaradas aprovadas por esta suíte.
