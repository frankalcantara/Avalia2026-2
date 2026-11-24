---
name: frontend-design
description: Orientação para design de interface intencional (tipografia, cor, ritmo, estados), evitando aparência genérica de template. Resumo versionado da skill usada pelo agente Frontend.
---

# Frontend design (resumo usado no projeto)

Chave Única do projeto: `P26-2B-4459-132C-62BC-7492`

- Escolher uma direção estética explícita antes de escrever CSS (tom, contraste, personalidade) e mantê-la em todas as telas.
- Tipografia com hierarquia clara usando a pilha de fontes do sistema (sem fontes externas, por causa da CSP).
- Paleta definida como variáveis CSS em `:root`, contraste AA, estados de foco visíveis.
- Alvos de toque de pelo menos 44 px; layout mobile-first de 320 px a desktop.
- Movimento com propósito (barra regressiva, feedback de resposta) e respeito a `prefers-reduced-motion`.
- Estados completos: carregando, vazio, erro, sucesso e desabilitado.
- Texto vindo do servidor sempre inserido com `textContent`, nunca como HTML.
