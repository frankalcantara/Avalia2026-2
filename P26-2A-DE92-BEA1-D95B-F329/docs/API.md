# Contrato compartilhado da aplicação

Projeto #39 — Construtor de Portfólio e Currículo Acadêmico. Frontend exclusivamente HTML/CSS/JavaScript puro, Pages Functions e D1. Toda implementação deve ficar nesta subpasta.

## Identidade e autenticação

- `GET /api/auth/discord`: iniciar OAuth2 Discord; retorno para `/api/auth/discord/callback`.
- `GET /api/session`: `{ user: null }` quando anônimo; autenticado retorna `{ user: { user_id, username, avatar_url }, csrf_token }`.
- `POST /api/logout`: sessão autenticada, cabeçalho `X-CSRF-Token`, encerra sessão.
- `GET /api/status`: diagnóstico sem dados pessoais ou segredos.

## Currículo

- `GET /api/curriculum`: autenticado; `{ curriculum }` com o currículo do usuário (ou um currículo vazio padrão).
- `PUT /api/curriculum`: autenticado + `X-CSRF-Token`; corpo é o objeto currículo abaixo. Retorna `{ curriculum }` persistido. A identidade vem exclusivamente da sessão.
- `GET /api/curriculum?user=ID`: público, apenas currículos com `is_public=true`; retorno `{ curriculum }`; dados privados e sessões nunca são incluídos. Rascunho/inexistente retorna 404.
- Erros em JSON: `{ error: "codigo", message: "Mensagem legível" }` e HTTP 400/401/403/404/413/500 conforme aplicável.

```json
{
  "user_id": "atribuído pelo servidor",
  "profile": {
    "full_name": "", "headline": "", "email": "", "phone": "",
    "location": "", "website": "", "summary": ""
  },
  "education": [{ "institution": "", "course": "", "start": "", "end": "", "description": "" }],
  "experience": [{ "company": "", "role": "", "start": "", "end": "", "description": "" }],
  "projects": [{ "name": "", "description": "", "url": "", "repository": "", "technologies": "" }],
  "skills": [{ "name": "", "level": "" }],
  "links": [{ "label": "", "url": "" }],
  "theme": "modern",
  "is_public": false,
  "updated_at": "atribuído pelo servidor"
}
```

Temas permitidos: `modern`, `classic`, `minimal`. Arrays podem ser vazios; todos os campos de texto são strings. Links externos devem usar `https:` ou `http:`; vazio é permitido. Email/telefone só são públicos quando o proprietário publicar o currículo com consentimento visível. Campos exigidos ao salvar: `profile.full_name` (2 a 120 caracteres). Validação de limites e autorização obrigatória no servidor. Identidade e timestamp enviados pelo cliente são ignorados.

## Interface e testes

- Visualização em tempo real, seletor de 3 temas, inclusão/remoção de entradas, salvamento real, publicação explícita, cópia de `/?user=ID`, PDF nativo com `@media print`.
- Exemplo demonstrativo pode ser local e deve ser claramente identificado. Nunca simular login nem declarar dados salvos sem resposta da API.
- Testar persistência, isolamento entre usuários, CSRF, payloads inválidos, URL maliciosa e ausência de publicação de rascunhos.
- Dados do formulário devem entrar no DOM com `textContent`, nunca interpolação HTML não confiável.
- Chave no rodapé: `P26-2A-DE92-BEA1-D95B-F329`.
