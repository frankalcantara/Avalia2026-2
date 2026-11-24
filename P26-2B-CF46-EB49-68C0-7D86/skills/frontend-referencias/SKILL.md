---
name: frontend-referencias
description: Planeja, implementa e revisa a interface do gerador de referências bibliográficas do Projeto 23 com HTML5, CSS3 e JavaScript puro, incluindo formulários, validação visual e apresentação dos resultados.
---

# Frontend do gerador de referências

- Identifique os tipos de fonte, campos obrigatórios e opções disponíveis no contrato do gerador. Se faltar uma definição, registre a lacuna antes de fixar esse comportamento na interface.
- Use controles HTML nativos com rótulos associados. Ao mudar o tipo de fonte, mantenha os campos compartilhados e envie apenas os dados relevantes para o tipo selecionado. Preserve os dados ao exibir erros.
- Associe mensagens de validação aos respectivos campos. Quando houver envio inválido, encaminhe o foco para o primeiro campo com erro. Anuncie atualizações de resultado e confirmações de cópia de forma acessível, quando esses fluxos existirem.
- Exiba a referência retornada pelo gerador como texto, preservando sua formatação. Insira texto digitado ou retornado com `textContent` ou APIs equivalentes do DOM.
- Verifique o fluxo alterado no navegador com teclado e em larguras de tela diferentes. Quando aplicável, cubra mudança de tipo de fonte, entrada inválida, geração e cópia do resultado.
