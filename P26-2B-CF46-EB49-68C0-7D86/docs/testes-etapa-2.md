# Testes da etapa 2

Execução local em 20 de novembro de 2026. O subagente `testes` leu o perfil e a skill `testes-referencias`, usou Node.js 26.13.1 no Windows e testou a interface bibliográfica em `dist/` e os handlers em `functions/api/`. Dados e sessões usados nos testes são fixtures. Prefixos SHA-256 da execução: módulo bibliográfico `F74E0FBE5C3A`, handler `B7ACC5FA7160` e migração `3C725D417333`.

## Execução reproduzível

```powershell
node --test tests/references.test.mjs tests/api.test.mjs
```

Resultado observado após os ajustes: **13 aprovações, zero falhas**. O runner contabiliza oito testes bibliográficos, quatro subtestes de API e o teste que os reúne.

| Caso | Resultado esperado | Resultado observado |
| --- | --- | --- |
| RF-02 a RF-04 (seis casos) | Livro, artigo e página web em ABNT e IEEE respeitam ordem dos elementos, autoria, pontuação e grifo para os dados da fixture. | As seis saídas e seus trechos em itálico coincidiram com as expectativas. |
| RF-03 e RT-02 | Espaço em branco no veículo obrigatório, data inexistente em ABNT e ausência da data em IEEE são recusados. | Editora, periódico, site e datas de acesso inválida ou ausente geraram erros nos campos correspondentes. |
| RF-06 | Ordem pt-BR por sobrenome ou título sem autoria, depois acentos, caixa, título e ID. IEEE recebe numeração após a ordenação da lista. | Duas ordens de entrada resultaram na mesma lista em ambos os estilos. Os casos incluem acentos, caixa, título sem autor e empate por ID. |
| RT-01 e RT-02 | A consulta anônima retorna sessão vazia e os projetos requerem autenticação. | Sessão anônima retornou `{ user: null }`, projetos retornaram `401` e sessão de fixture apresentou nome e avatar. |
| RF-05 e RT-02 | Gravar projeto e referência válidos e rejeitar dados inválidos. | As gravações válidas retornaram `201`. Nome de projeto vazio e referência sem editora retornaram `422`. |
| RF-05, RT-02 e RT-03 | Reabrir projeto e referências após reabrir o banco. Uma segunda conta fica sem acesso. | Os dados sobreviveram à reabertura do SQLite. Outra conta obteve lista própria vazia e `404` ao consultar a coleção ou tentar atualizar a referência. |
| RF-05 e RT-01 | Atualizar e excluir uma referência, revogar a sessão e exigir nova autenticação na próxima chamada. | A alteração apareceu na listagem, a exclusão retornou `204`, a exclusão do projeto removeu suas referências em cascata, o logout retornou `204` e a chamada seguinte retornou `401`. |

Os exemplos usam dados fictícios. A conferência se baseou nas seções 7.1, 7.7.5–7.7.6, 7.20, 8 e 9 para ABNT e nas seções II.A, II.M e II.T para IEEE. [ABNT NBR 6023:2025](https://mccicm.uff.br/wp-content/uploads/sites/79/2026/03/ABNT_NBR_6023_2025-Informacao-e-documentacao-%E2%80%94-Referencias-%E2%80%94-Elaboracao.pdf) e [IEEE Reference Style Guide for Authors](https://docs.google.com/document/d/e/2PACX-1vSBoV_hTIURPZKtQkxI6bAONJtjyDLxQIUvCHi-XPzD8NKLcxRfZrpvQLFrjWZ3M6FFR_Obau3R-t63/pub).

## Achados e reteste

- A página web em ABNT destacava o título da página. Após a correção, o grifo passou para o nome do site no exemplo com autoria.
- A página web em IEEE apresentava a data depois do URL. Após a correção, a saída inclui a data de acesso antes de `[Online]. Available:`, e a validação exige a data.
- A primeira expectativa de ordenação tratava as variantes de acento e caixa como empate. O contrato passou a explicitar o desempate por acento e caixa antes do título. O teste recebeu também duas entradas com a mesma autoria e o mesmo título para verificar o desempate por ID.

## Limites da verificação

- A suíte de API importou o handler real, aplicou a migração em SQLite em arquivo e exercitou o binding por um adaptador de teste. Pages Functions e Cloudflare D1 em seu runtime próprio ficaram fora desta execução.
- O subagente `frontend` executou verificações em Chrome headless local. Relatou renderização das seis combinações, foco e indicação de erro de campo obrigatório, alternância de fonte, navegação por teclado, cópia da prévia e larguras de 320, 768 e 1280 px.
- A interface testada gera e copia a prévia individual. A integração de projetos e a cópia integral em uma sessão de navegador continuam pendentes.
- O login Discord completo, o redirecionamento OAuth2 real, os recursos remotos, a publicação e a validação acadêmica oficial ficaram fora desta execução. Os exemplos bibliográficos conferidos representam os seis cenários da suíte.
