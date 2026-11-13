---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2B-8983-AF39-E3CF-C0B3/`.
2. **Autenticação e Autorização:** Confirmar que APIs privadas recusam sessões ausentes/inválidas e que um usuário não consegue alterar favoritos de outro.
3. **Validação de Dados:** Confirmar que receitas com quantidade não positiva/não numérica, rendimento/tempo fora dos limites, ingredientes/etapas ausentes ou IDs inválidos são rejeitadas com erros HTTP apropriados (`400`, `401`, `403`, `404`, `409`).
4. **Busca e Persistência:** Verificar busca por título, ingrediente e tempo; favoritos devem ser isolados por usuário e persistidos no D1.
5. **Escalonador de Porções:** Confirmar que a quantidade exibida é `quantidadeOriginal * porçõesDesejadas / rendimentoOriginal`, que a unidade permanece separada e que várias alterações partem da quantidade original (sem erro cumulativo).
6. **Interface Segura:** Confirmar uso de DOM APIs/texto para conteúdo de receitas, ausência de frameworks de interface e presença da chave oficial no `<footer>`.
7. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2B-8983-AF39-E3CF-C0B3` na raiz. Diferenciar checks estruturais locais do check de disponibilidade Cloudflare, que depende de deploy real.
