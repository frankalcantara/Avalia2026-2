---
name: teste-validacao
description: Verificações locais de sintaxe, autorização, persistência e aderência aos requisitos do mural.
---

# Teste e validação

- Verifique sintaxe dos módulos JavaScript e integridade SQL da migração.
- Confirme que APIs de conteúdo recusam sessões ausentes e que a identidade não é controlada pelo cliente.
- Verifique isolamento de inscrições e estados por usuário, além de edição e exclusão limitadas ao autor.
- Confirme validação dos campos, uso de statements parametrizados, estados HTTP e ausência de frameworks no frontend.
- Execute `node validar-local.mjs P26-2B-53BA-625A-BA24-E918` após configurar uma URL real; diferencie claramente verificações locais de deploy/OAuth ainda indisponíveis.
