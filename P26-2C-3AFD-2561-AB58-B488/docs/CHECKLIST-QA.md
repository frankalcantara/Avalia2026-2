# Checklist de validação (ambiente publicado)

- [ ] Abrir a URL em HTTPS sem erros no console.
- [ ] Sem login, a tela de entrada aparece e `/api/quotes` responde 401.
- [ ] "Entrar com Discord" volta logado, com nome e avatar corretos.
- [ ] Criar citação privada: aparece em "Meu acervo", NÃO aparece no feed.
- [ ] Editar para pública: aparece no feed da turma.
- [ ] Segundo usuário não vê as privadas, não edita nem exclui as de outros (testar `PUT`/`DELETE` direto: 403).
- [ ] Busca por autor e por tema atualiza a lista enquanto digita.
- [ ] "Citação aleatória" só mostra públicas e evita repetir a anterior.
- [ ] Texto com `<script>alert(1)</script>` aparece como texto, sem executar.
- [ ] Layout ok em 360 px de largura.
- [ ] Chave `P26-2C-3AFD-2561-AB58-B488` no rodapé e no README.
