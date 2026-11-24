---
name: seguranca-serverless
description: Revisão de autenticação Discord OAuth2, sessões e segurança em Pages Functions com D1.
---
# Segurança serverless
1. Usar code flow e `state` imprevisível com cookie SameSite=Lax, Secure, HttpOnly.
2. Trocar code no servidor com Client Secret secreto; validar identidade via API Discord.
3. Garantir sessão assinada com expiração e isolar consultas por user_id autenticado.
4. Aplicar validações de categoria, horas e certificado no servidor, com query parametrizada.
5. Nunca versionar `.env` ou tokens; verificar CSRF nas operações mutáveis e origem das chamadas.
