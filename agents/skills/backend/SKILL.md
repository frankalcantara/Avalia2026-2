# Skill: Backend Cloudflare

- Implemente endpoints com Cloudflare Pages Functions e banco D1 via prepared statements.
- Valide autenticação no servidor em toda operação privada.
- Para editar/excluir posts, inclua `author_id` do usuário da sessão na condição SQL; nunca confie em um ID de autor enviado pelo cliente.
- Use OAuth2 Authorization Code do Discord com `state` validado e escopo mínimo `identify`.
- Armazene sessão em cookie HttpOnly, Secure e SameSite; assine os dados e defina expiração.
- Mantenha Client Secret e segredo de sessão apenas em variáveis secretas do ambiente.
- Valide tamanho e presença dos campos no backend e use prepared statements.
- Retorne erros JSON consistentes e não exponha segredos.
