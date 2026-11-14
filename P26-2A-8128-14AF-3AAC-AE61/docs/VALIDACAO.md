# Relatório independente de teste e validação

Agente: `/root/teste_validacao`. Harness: Codex desktop, ferramenta de colaboração com agente separado dos implementadores. Data: 13/11/2026. Skill usada: `skills/teste-validacao/SKILL.md`.

## Estratégia

Os testes em `tests/api.test.mjs` executam o código real da API no runtime local Miniflare/workerd com um banco D1 isolado e descartável. As migrações reais são aplicadas nesse banco. Fixtures são inseridas diretamente no D1 de teste; nenhum endpoint alternativo de autenticação é disponibilizado na aplicação.

O teste executa HTTP, queries e triggers reais. Chamadas externas são bloqueadas pelo mock de rede. A autorização OAuth real de uma conta Discord e a publicação Cloudflare foram verificadas separadamente, conforme resultados abaixo.

## Cobertura executada

- Leitura pública, perfil autenticado, ausência de login fictício, cookie falsificado e sessão expirada.
- Origem de escrita, JSON e validação de campos no servidor, proteção contra SQL injection.
- Cadastro, filtros, edição, exclusão lógica e autorização por proprietário.
- Empréstimo: solicitação, reserva, data prevista, aprovação, recusa, cancelamento e devolução.
- Troca: validação do livro oferecido, reserva dos dois livros, aprovação, conclusão e transferência de propriedade.
- Concorrência: duas pessoas tentando reservar o mesmo livro e duas trocas disputando um único exemplar oferecido, com verificação de ausência de reserva órfã.
- OAuth state/cookies e logout com revogação no D1.
- Validador oficial do professor, integridade da pasta e rastreabilidade da chave.

## Resultados

Execução finalizada pelo agente principal em 13/11/2026 após o limite de uso interromper o agente de testes.

- `npm.cmd test`: 27 testes aprovados, zero falhas, incluindo OAuth com respostas simuladas, concorrência de reservas e dois testes de calendário São Paulo.
- `npm.cmd run build:check`: Pages Functions compiladas com sucesso.
- Migração inicial aplicada em D1 local e remoto exclusivos do projeto.
- HTTP local: `/`, `/app.js`, `/styles.css`, `/api/status`, `/api/me` e `/api/books` responderam 200. POST anônimo em livros respondeu 401.
- Navegador local: catálogo, busca sem resultados, limpar filtros, painel anônimo e exigência de login conferidos; console sem erros. Largura de celular sem rolagem horizontal.

Correções na integração: Miniflare 5 não converte modulesRules; a suíte passou a receber o módulo empacotado pelo esbuild. O DELETE válido passou a enviar objeto JSON vazio, como o contrato e a interface exigem. As datas foram ajustadas de UTC para São Paulo.

## Verificações em produção

- Site público HTTPS: https://entrelivros-rennan.pages.dev, com a chave correta no rodapé.
- `/api/status`: D1 conectado e OAuth configurado.
- Login real retornou do Discord e exibiu nome, handle, user_id e avatar no site.
- Formulário autenticado de cadastro aberto e campo título vazio bloqueado pela validação do navegador. Nenhum livro fictício foi inserido no catálogo de produção.
- Validador oficial: todos os nove itens aprovados, incluindo disponibilidade da URL pública.
- Projeto 0 corrigido: login real, gravação de um registro de diagnóstico e leitura após recarregar a página. Validador oficial do Projeto 0 também aprovado.
- Código no fork público de Rennan, em branch separada da pasta de treino.

## Validação no laboratório relatada pelo estudante

Relatos consolidados em 14/11/2026. As verificações abaixo foram executadas pelo estudante e seu colega, com orientação nesta conversa. Os resultados foram informados por eles; não se trata de observação direta do agente no computador da instituição.

- Node.js e Git instalados pelo Scoop no computador da faculdade; comandos de versão funcionaram e o caminho do Node.js indicou a pasta Scoop.
- Projetos 24 e 0 baixados em pastas separadas. Inicializadores executados com as respectivas chaves, nove itens `[OK]` em ambos os validadores e `working tree clean` ao final.
- Projeto 0 no navegador da faculdade: login Discord funcionou e um novo registro de diagnóstico permaneceu após F5.
- EntreLivros: cadastro de livro, permanência após F5 e localização pela busca confirmados pelo estudante.
- Colega usando outra conta pelo celular: solicitação de empréstimo visível nos dois painéis e exemplar reservado.
- Estudante confirmou aprovação do empréstimo com data de devolução e registro da devolução, relatando funcionamento do fluxo.

## Limites e fechamento

- Empréstimo entre duas contas reais confirmado pelo relato acima. O fluxo completo de troca permanece coberto pelos testes automatizados de API; o ensaio manual de troca com dois exemplares ainda é recomendado.
- A tentativa de conferência visual adicional em ambiente local foi interrompida por indisponibilidade do acesso ao navegador.
- A postagem das URLs no AVA e o comprovante de entrega ainda dependem do estudante.
- Pull Request oficial #37 aberto: https://github.com/frankalcantara/Avalia2026-2/pull/37. A pré-inspeção remota marcou os cinco grupos de requisitos como OK: https://github.com/frankalcantara/Avalia2026-2/pull/37#issuecomment-6868245359. Isso não representa a nota final.

## Referências técnicas consultadas

- [D1 no Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/storage/d1/).
- [Módulos no Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/core/modules/).
- [Mock de chamadas externas](https://developers.cloudflare.com/workers/testing/miniflare/core/standards/).
