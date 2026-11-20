# Testes da etapa 3

Execução local em 20 de novembro de 2026 pelo subagente `testes`, com a skill `testes-referencias` e as instruções de prévia local da skill `sites:sites`. Ambiente Windows, Node.js 26.13.1 e Chrome headless 157.0.8103.79. Os prefixos SHA-256 são `6A0E7B1EB556` (HTML), `8CF7C3E95619` (app), `F74E0FBE5C3A` (formatador), `B9F0F6454820` (handler) e `3C725D417333` (migração).

```powershell
node --test tests/references.test.mjs tests/api.test.mjs tests/browser.test.mjs
```

Resultado observado: **21 aprovações e zero falhas**. O runner contabiliza oito casos bibliográficos, cinco subtestes de API e seis subtestes de navegador, mais os dois testes que os reúnem. O teste de navegador usa o Chrome ou Edge instalado nos caminhos padrão do Windows. Para outro caminho, aponte `CHROME_PATH` para o executável Chromium.

| Verificação | Resultado esperado | Resultado observado |
| --- | --- | --- |
| Sessão anônima e isolamento | Projetos indisponíveis para anônimos e recursos privados visíveis somente ao titular. | O gerenciador ficou oculto no navegador anônimo. A API retornou `401` sem sessão, coleção vazia para a segunda conta e `404` para um projeto de outra conta. |
| Projetos e referências | Criar, reabrir, editar e excluir por projeto, sem misturar coleções. | Duas coleções foram criadas no formulário. A primeira preservou referências após alternar, retornar e navegar de novo. A segunda ficou intacta após excluir a primeira. Edição e exclusão de referência foram confirmadas pela API e pela interface. |
| Persistência relacional | A migração permite gravar dados duráveis e exclui referências vinculadas quando o projeto é removido. | A suíte de API fechou e reabriu o SQLite em arquivo e releu projeto e referência. Confirmou exclusão em cascata e revogação da sessão. |
| Validação e falha de serviço | Formulário sinaliza campos obrigatórios. Backend recusa entrada inválida e a interface mostra mensagem pública em caso de erro. | O navegador sinalizou campo obrigatório. Requisições inválidas retornaram `422`. Uma falha induzida no binding do harness retornou `500`, com feedback na interface e sem o texto interno injetado. |
| Compilação alfabetizada e grifo | Referências persistidas aparecem em ordem alfabética. A troca de estilo preserva IDs e aplica números sequenciais em IEEE. | O botão Compilar bibliografia fez uma nova consulta e anunciou o estado vazio ou concluído. Duas referências cadastradas na ordem inversa saíram em ordem alfabética. Os trechos em grifo apareceram na tela. A troca para IEEE produziu `[1]` e `[2]` sem alterar os IDs. As seis saídas normativas da etapa anterior continuaram aprovadas. |
| Cópia integral | O clique copia todas as referências do projeto na ordem da API, com pontuação e separação entre linhas, e informa o resultado. | Leitura da área de transferência real retornou as duas referências e a interface confirmou a cópia. No Chrome em Windows, a área de transferência retornou CRLF para o LF da API. O teste normalizou apenas esse separador antes de comparar o conteúdo. Após negar efetivamente a permissão de escrita no Chrome, a interface orientou a cópia manual. |
| Seleção e alterações concorrentes | Uma listagem atrasada não deve substituir a coleção selecionada. Duas mudanças independentes não devem se sobrescrever. | O navegador manteve vazia a coleção do segundo projeto durante a troca rápida, mesmo após a consulta anterior terminar. Dois PATCH concorrentes retornaram `200` e preservaram nome e estilo. Uma atualização intercalada imediatamente antes da gravação gerou `409 concurrent_update` e a alteração mais recente permaneceu no banco. |

A saída copiada usa texto simples. O grifo permanece visível na interface e nos segmentos do contrato da API.

O servidor de teste oferece arquivos de `dist/` em loopback e encaminha requisições ao handler real com um adaptador SQLite para o binding D1. As duas sessões são criadas pelo harness e os cookies são inseridos no perfil temporário do Chrome. O teste usa requisições reais do navegador e acessa a área de transferência pela API do Chromium. O login Discord OAuth2 real, a execução no runtime Cloudflare, o D1 do provedor e a publicação seguem pendentes.
