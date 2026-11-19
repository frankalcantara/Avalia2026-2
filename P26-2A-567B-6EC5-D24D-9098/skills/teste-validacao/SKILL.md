Skill: Agente de Teste e Validação

Checklist de Verificação Obrigatória

1. Isolamento de Subpasta: Confirmar que todos os arquivos do projeto residem exclusivamente dentro de P26-2A-567B-6EC5-D24D-9098/.
2. Teste Anti-Manipulação: Verificar que chamadas POST/PUT/PATCH para /api/* rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (400, 401, 403, 409).
3. Conformidade de Entrega: Executar node validar-local.mjs P26-2A-567B-6EC5-D24D-9098 na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

Casos de teste do Bookmark Manager

- Sem login → 401 nas rotas protegidas.
- URL inválida (javascript:, ftp:) → 400; status fora dos 3 permitidos → 400; título vazio → 400.
- CRUD de coleção e de link; filtro combinado coleção + status.
- Acesso a coleção/link de OUTRO usuário → 403 ou 404.
- Coleção privada em /api/public/:slug → 404; coleção pública → 200 sem login.
- XSS: título com <script> aparece como texto, não executa.
- Interface: só HTML/CSS/JS puro; sem innerHTML com dados do usuário; chave no <footer> das duas páginas; responsivo em 360, 768 e 1280px.

Como reportar

- Cada achado com gravidade (crítico, alto, médio, baixo), arquivo, trecho e correção mínima sugerida.
- Registrar caso, resultado e evidência em tests/RELATORIO_QA.md, sem inventar resultados.
- O agente de teste não implementa funcionalidades: só testa, revisa e reporta.