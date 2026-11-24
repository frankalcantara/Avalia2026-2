# Pendências do Projeto #23

Comparação em 20 de novembro de 2026 entre a [especificação](../REQUISITOS.md) e o estado após a etapa 4. As evidências e os limites estão no [histórico](HISTORICO.md) e no [relatório de testes](testes-etapa-4.md).

| Requisito | Estado observado | O que falta |
| --- | --- | --- |
| RF-01 | Interface HTML5, CSS3 e JavaScript puro, com sessão, perfil e gestão verificados em Chrome headless local. | Verificar o fluxo na versão publicada. |
| RF-02 e RF-03 | Formulários para livro, artigo de periódico e página web, com campos de veículo específicos e validação compartilhada. Os três fluxos foram exercitados. | Ampliar os casos de validação conforme a cobertura normativa dos campos complementares e de autoria. |
| RF-04 | Seis exemplos verificados em ABNT e IEEE, com autoria, pontuação e grifo esperados para as fixtures. A interface usa os segmentos do formatador. | Ampliar os exemplos normativos e a cobertura de variantes de autoria, campos opcionais e metadados por tipo. |
| RF-05 | CRUD e reabertura testados no navegador com sessão válida e SQLite local. O isolamento entre contas foi verificado. | Repetir o fluxo com contas Discord reais e D1 remoto. |
| RF-06 | Bibliografia do projeto compilada na API e exibida na interface. Ordenação pt-BR e numeração IEEE foram exercitadas em testes locais, inclusive com dados persistidos. | Verificar o fluxo e a ordenação no runtime da Cloudflare. |
| RF-07 | Cópia integral em texto simples, preservando ordem, pontuação e quebras de linha. O grifo fica na visualização. Cópia real e feedback de falha verificados no Chrome local. | Verificar a cópia em HTTPS na versão publicada. |
| RT-01 | Authorization Code Flow, importação de perfil, cookies de sessão, logout e acesso protegido implementados. Os testes locais exercitaram o callback real da aplicação com o Discord interceptado, inclusive cancelamento, expiração e renovação. | Cadastrar a aplicação Discord e a URL de retorno, configurar as credenciais privadas no ambiente alvo e validar o fluxo com o provedor real. |
| RT-02 e RT-03 | Wrangler aplicou as migrações e compilou as Pages Functions. A prévia HTTPS verificou o binding e rotas básicas. A suíte integrada verificou autorização e persistência também via adaptador SQLite. | Configurar o binding `DB` no projeto Cloudflare com o D1 real, aplicar as migrações remotas e validar a integração no ambiente alvo. |
| RE-01 | A etapa foi local. | Publicar na Cloudflare e verificar o fluxo completo em HTTPS. |
| RE-02 | O workspace atual não apresenta repositório Git nem arquivo `LICENSE`. | Confirmar o fork público, publicar o código e incluir a licença MIT na entrega. |
| RE-03 | Três subagentes executados, com perfis, skills, documentação e registro do harness. | Acomodar as skills na estrutura oficial da entrega e manter o histórico de execução. |
| RE-04 | A chave acadêmica está no rodapé local. | Registrar a chave no `README.md` e preencher a URL pública quando disponível. |
| RE-05 | Interface de desenvolvimento em `dist/`, sem evidência de inicialização no laboratório. | Executar `node iniciar.mjs` com a chave na raiz do fork no laboratório e acomodar o projeto na pasta oficial, com `public/` para a interface. |
| RE-06 e RE-07 | Validação acadêmica, PR e envio no AVA sem evidência no histórico. | Executar o validador oficial, abrir o PR com a pasta do projeto e entregar as URLs do site e do GitHub no AVA. |

## Após a integração na pasta oficial

A interface está em `public/` e a chave consta no README e no rodapé. A licença MIT oficial, os perfis, os skills e as evidências das quatro etapas foram preservados. A pasta oficial já existia no checkout inspecionado. As verificações da integração foram registradas no [histórico](HISTORICO.md). Permanecem pendentes a confirmação do fork público, a configuração do Discord e do D1 reais, a validação publicada, o PR e a entrega no AVA.