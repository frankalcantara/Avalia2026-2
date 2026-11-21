---
name: teste-validacao
description: Use depois de qualquer mudança no Catálogo de Filmes (P26-2A-52D1-7EC2-3200-758A) e antes de cada deploy ou Pull Request. Protocolo do Agente de Teste e Validação para tentar quebrar as regras no servidor, conferir o D1 e a rubrica.
---

# Skill: Agente de Teste e Validação

O objetivo deste agente é **encontrar problemas**, não confirmar que está tudo certo. Ele testa como um usuário mal-intencionado
testaria e só aprova quando todos os passos abaixo passam.

## Passo 1: ambiente local igual à produção
```bash
npx wrangler d1 migrations apply DB --local
npx wrangler d1 execute DB --local --command "INSERT INTO discord_users(user_id,username,avatar) VALUES('111','A','x'),('222','B','y'); INSERT INTO sessoes VALUES('<64 letras a>','111','2099-01-01'),('<64 letras b>','222','2099-01-01');"
npx wrangler pages dev public --port 8788
```

## Passo 2: bateria automática
```bash
SESSAO_A=<64 letras a> SESSAO_B=<64 letras b> node testes/testar-api.mjs http://127.0.0.1:8788
```
Precisa terminar com **0 reprovados**. Cobertura mínima obrigatória:
1. **Sem login → 401** em toda rota que grava (`POST /api/titulos`, `PUT` e `DELETE` de avaliação), inclusive com cookie inventado.
2. **Dados inválidos → 400:** nota fora de 1–5, nota decimal, nota como texto, resenha > 500, tipo desconhecido, id não numérico.
3. **Chave composta:** a segunda avaliação da mesma pessoa no mesmo título vira edição (200) e continua existindo um só registro.
4. **Falsificação de identidade:** enviar `user_id` de outra pessoa no corpo não pode alterar a nota dela.
5. **Agregação:** média e total devolvidos batem com o cálculo manual a partir das resenhas.
6. **Ordenações:** `media`, `popularidade` e `recentes` em ordem decrescente do campo certo.
7. **Injeção:** busca com `%' OR 1=1 --` responde 200 sem resultados.
8. **OAuth:** `/api/auth/discord` redireciona com `state`; callback com `state` forjado é recusado.

## Passo 3: interface
- Abrir em 1280px e em 390px (Playwright/Chrome headless ou o navegador).
- Fluxo completo: abrir título → escolher estrelas → publicar → editar → remover; cadastrar título; cadastrar duplicado (409).
- Console sem erros de JavaScript. Chave visível no rodapé.

## Passo 4: rubrica
```bash
node validar-local.mjs P26-2A-52D1-7EC2-3200-758A   # na raiz do repositório
```
Todos os itens determinísticos ✅. Depois do deploy, repetir o Passo 2 contra a URL pública (só testes sem login).

## Ao encontrar um bug
Registrar na tabela "Bugs encontrados" do `AGENTS.md` (onde, problema, qual agente corrigiu), devolver ao agente
responsável e rodar a bateria inteira de novo depois da correção.
