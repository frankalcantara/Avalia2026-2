/* Acervo: citações e notas de leitura. JavaScript puro, sem bibliotecas.
   Todo texto vindo do usuário entra no DOM somente via textContent / createTextNode.
   Todo texto visível da interface vive em I18N: pt aqui, en em i18n-en.js (mesmas chaves). LANG troca na hora (botão PT | EN). */

const I18N = {
  pt: {
    "meta.lang": "pt-BR",
    "meta.speechLang": "pt-BR",
    "meta.locale": "pt-BR",
    "meta.appName": "Acervo",
    "footer.key": "Chave única:", "footer.project": "Acervo, Projeto #41, 2026",
    "meta.titleSuffix": " | Acervo",
    "meta.homeTitle": "Acervo: citações e notas de leitura",
    "meta.description": "Guarde trechos de livros, artigos e palestras, escreva sua reflexão na margem e compartilhe com a turma.",

    /* Troca de idioma */
    "skip.link": "Pular para o conteúdo",
    "lang.group": "Idioma", "lang.pt": "Português", "lang.en": "Inglês",
    "lang.current": "{name} (idioma atual)", "lang.switch": "Mudar para {name}", "lang.announce": "Idioma: português.",

    /* Títulos de tela */
    "title.entrada": "Acervo", "title.entrar": "Entrar no Acervo", "title.feed": "Feed da turma", "title.minhas": "Minhas citações",
    "title.nova": "Nova citação", "title.editar": "Editar citação", "title.importar": "Importar citações", "title.404": "Página não encontrada",

    /* Navegação e cabeçalho */
    "brand.aria": "Acervo, página inicial",
    "nav.aria": "Principal", "nav.feed": "Feed da turma", "nav.mine": "Minhas citações", "nav.new": "Nova citação", "nav.import": "Importar", "nav.discord": "Servidor do Discord",
    "invite.title": "Quer participar do nosso servidor sobre livros e citações?", "invite.body": "É opcional. Se aceitar, o convite abre em uma nova aba no Discord, e você decide lá se entra. Você pode mudar de ideia depois pelo item \"Servidor do Discord\" no menu.", "invite.yes": "Sim, quero entrar", "invite.no": "Agora não",
    "search.formAria": "Buscar citações", "search.label": "Buscar autor ou tema", "search.placeholder": "Buscar autor ou tema",
    "search.listAria": "Buscar nesta lista", "search.minePlaceholder": "Buscar nas minhas citações", "search.in": "Buscar em",
    "search.author": "Autor", "search.topic": "Tema", "search.all": "Tudo", "search.clear": "Limpar busca",
    "theme.label": "Tema escuro", "user.logout": "Sair", "menu.open": "Abrir menu", "menu.close": "Fechar menu",
    "toast.bye": "Você saiu do Acervo.", "toast.welcome": "Bem-vindo, {name}.",

    /* Entrada e login */
    "entrada.quote": "Marcela amou-me durante quinze meses e onze contos de réis.",
    "entrada.noteAria": "Anotação de exemplo", "entrada.note": "Preço e afeto na mesma frase. Reler antes da resenha.",
    "entrada.refAuthor": "Machado de Assis", "entrada.refWork": "Memórias Póstumas de Brás Cubas", "entrada.refPage": "p. 38",
    "entrada.example": "Citação de domínio público, usada como exemplo.",
    "entrada.title": "Guarde o que vale reler",
    "entrada.lead": "Reúna trechos de livros, artigos e palestras, escreva sua reflexão na margem e releia quando precisar.",
    "entrada.privacy": "Só usamos seu nome e avatar do Discord.",
    "entrada.netErr": "Não foi possível falar com o servidor agora. Recarregue a página para tentar de novo.",
    "discord.btn": "Entrar com Discord", "discord.opening": "Abrindo o Discord...",
    "login.title": "Entrar no Acervo", "login.lead": "Use sua conta do Discord para guardar suas citações e ver o feed da turma.",
    "login.error": "Não foi possível entrar. Tente de novo.", "login.retry": "Tentar de novo",
    "login.privacy": "Só usamos seu nome e avatar. Não pedimos senha.", "login.helpSummary": "Problemas para entrar?",
    "login.helpBody": "Confira se você está conectado ao Discord neste navegador e se autorizou o acesso ao seu nome e avatar. Se o erro continuar, feche outras abas do Acervo e tente de novo.",
    "login.noteAria": "Nota", "login.note": "Seu acervo começa privado. Você escolhe o que a turma pode ler.",
    "login.expired": "Sua sessão expirou. Entre de novo.", "login.verifyFail": "Não foi possível verificar sua sessão. Tente de novo.",
    "login.codeDetail": "Código do erro: {code}",

    /* Formulário */
    "form.leadNew": "Guarde o trecho, de onde veio e o que você pensou ao ler.", "form.leadEdit": "Ajuste o trecho, a referência ou a reflexão.",
    "form.text": "Trecho da citação", "form.textHelp": "A citação aparece exatamente como você escrever.",
    "form.author": "Autor", "form.work": "Obra (livro, artigo ou palestra)", "form.workPlaceholder": "Ex.: Mensagem",
    "form.page": "Página", "form.pageHelp": "Opcional para palestra.", "form.reflection": "Minha reflexão",
    "form.tags": "Tags", "form.tagsHelp": "Separe por vírgula ou Enter. Até 8 tags, sem #.", "form.tagsPlaceholder": "Ex.: filosofia",
    "form.tagsListAria": "Tags adicionadas", "form.tagRemove": "Remover tag {tag}", "form.tagsCount": "{n} de {max} tags",
    "form.visibility": "Visibilidade", "form.private": "Privada", "form.public": "Pública",
    "form.visHelp": "Pública aparece no feed da turma. Privada só você vê.",
    "form.save": "Salvar citação", "form.saveEdit": "Salvar alterações", "form.saving": "Salvando...", "form.cancel": "Cancelar",
    "form.saved": "Citação salva", "form.viewMine": "Ver em Minhas citações", "form.updated": "Citação atualizada.",
    "form.previewAria": "Pré-visualização", "form.preview": "Pré-visualização", "form.previewEmpty": "Seu trecho aparece aqui, com marca-texto.",
    "form.reflectionAria": "Reflexão",
    "val.textRequired": "Escreva o trecho da citação.", "val.authorRequired": "Informe o autor.",
    "val.pageInt": "A página deve ser um número inteiro maior ou igual a 0.",
    "val.tooLong": "Máximo de {max} caracteres.", "val.tagsMany": "Use no máximo {max} tags.", "val.tagLong": "Cada tag pode ter até {max} caracteres.",
    "form.onlyOwnEdit": "Você só pode editar citações que são suas.",
    "route.onlyOwnEdit": "Você só pode editar as suas próprias citações.", "route.openFromMine": "Abra a citação a partir de Minhas citações para editar.",

    /* Listas */
    "mine.lead": "Tudo o que você guardou, público ou privado.", "feed.lead": "Citações que a turma marcou como públicas.",
    "mine.filterAria": "Filtrar por visibilidade", "mine.all": "Todas", "mine.public": "Públicas", "mine.private": "Privadas",
    "list.more": "Carregar mais", "list.loading": "Carregando...", "list.loadingAria": "Carregando citações", "list.retry": "Tentar de novo",
    "list.emptyMine": "Você ainda não guardou nenhuma citação.", "list.emptyMinePublic": "Você ainda não tem citações públicas.",
    "list.emptyMinePrivate": "Você ainda não tem citações privadas.", "list.emptyFeed": "Ninguém compartilhou ainda. Marque uma citação como Pública para abrir o feed.",
    "list.emptyFiltered": "Nenhuma citação com esse filtro.", "list.clearFilter": "Limpar filtro",
    "list.newBtn": "Nova citação",
    "list.count.one": "{n} citação", "list.count.many": "{n} citações", "list.loadedSuffix": " carregadas",
    "list.found.one": "{n} citação encontrada", "list.found.many": "{n} citações encontradas",
    "list.noMatch": "Nada para ‘{term}’. Tente outro autor ou tema.", "list.loadMoreHint": " Carregue mais citações para ampliar a busca.",
    "quote.public": "Pública", "quote.private": "Privada", "quote.edit": "Editar", "quote.editAria": "Editar citação de {author}",
    "quote.delete": "Excluir", "quote.deleteAria": "Excluir citação de {author}", "quote.deleting": "Excluindo...",
    "quote.confirmGroup": "Confirmar exclusão", "quote.confirmText": "Excluir esta citação? Isso não pode ser desfeito.",
    "quote.deleted": "Citação excluída.", "quote.onlyOwnDelete": "Você só pode excluir citações que são suas.",
    "quote.sharedOn": "compartilhou em {date}", "quote.someone": "Aluno da turma",
    "quote.sharedBy": "Compartilhada por {name}", "quote.sharedByOn": "Compartilhada por {name} em {date}",
    "quote.page": "p. {page}",

    /* Citação aleatória */
    "random.btn": "Citação aleatória", "random.title": "Citação aleatória", "random.again": "Sortear outra", "random.close": "Fechar",
    "random.escHint": "Esc também fecha", "random.drawing": "Sorteando uma citação", "random.empty": "Ainda não há citações públicas para sortear.",
    "random.error": "Não foi possível sortear agora. Tente de novo.",

    /* Erros de API */
    "api.network": "Sem conexão com o servidor. Verifique sua internet e tente de novo.",
    "api.401": "Sua sessão expirou. Entre de novo.", "api.403": "Você não tem permissão para fazer isso.",
    "api.404": "Não encontramos essa citação. Ela pode ter sido removida.", "api.400": "Confira os campos e tente de novo.",
    "api.5xx": "O servidor teve um problema. Tente de novo em instantes.", "api.other": "Algo deu errado. Tente de novo.",
    "api.unavailable": "Este recurso ainda não está disponível no servidor. Tente de novo mais tarde.",

    /* Mensagens do servidor (já em português) */
    "srv.unauth": "Não autenticado.", "srv.origin": "Origem não permitida.", "srv.method": "Método não permitido.",
    "srv.contentType": "Content-Type deve ser application/json.", "srv.tooBig": "Corpo da requisição grande demais.",
    "srv.badBody": "Corpo inválido.", "srv.notObject": "O corpo deve ser um objeto JSON.", "srv.badJson": "JSON inválido.",
    "srv.badParam": "Parâmetro inválido.", "srv.badTag": "Tag inválida.", "srv.posInt": "Deve ser um inteiro positivo.", "srv.badCursor": "Cursor inválido.",
    "srv.errList": "Erro interno ao consultar o acervo.", "srv.errTags": "Erro interno ao consultar as tags.",
    "srv.errQuote": "Erro interno ao processar a citação.", "srv.errSave": "Erro interno ao salvar a citação.",
    "srv.errImport": "Erro interno ao importar as citações.", "srv.errColl": "Erro interno ao processar a coleção.",
    "srv.errGeneric": "Erro interno.",
    "srv.collNotFound": "Coleção não encontrada.", "srv.collForeign": "Você não pode alterar a coleção de outro usuário.",
    "srv.quoteNotFound": "Citação não encontrada.", "srv.quoteForeign": "Você não pode alterar a citação de outro usuário.",
    "srv.invalidData": "Dados inválidos.", "srv.inviteAction": "Use 'accepted' ou 'dismissed'.",
    "srv.itemsMin": "Envie uma lista com ao menos 1 item.", "srv.itemsMax": "Máximo de {n} itens por importação.",
    "srv.collDup": "Você já tem uma coleção com esse nome.", "srv.nameUsed": "Nome já em uso.", "srv.nameReq": "O nome é obrigatório.",
    "srv.isText": "Deve ser um texto.", "srv.textReq": "O trecho é obrigatório.", "srv.authorReq": "O autor é obrigatório.",
    "srv.pageInt": "A página deve ser um inteiro maior ou igual a 0.", "srv.tagsList": "Deve ser uma lista de tags.",
    "srv.tagFormat": "Cada tag deve ter de 1 a {n} caracteres, só letras, números, _ ou -.", "srv.tagsMax": "Máximo de {n} tags por citação.",
    "srv.idsMax": "Deve ser uma lista com até {n} ids.", "srv.idPos": "Cada id deve ser um inteiro positivo.",
    "srv.idsMissing": "Há citações inexistentes ou que não são suas.", "srv.visParam": "Use all, public ou private.", "srv.isObject": "Deve ser um objeto.",

    /* 404 */
    "nf.title": "Página não encontrada", "nf.lead": "Esse endereço não existe no Acervo.", "nf.back": "Voltar ao início",

    /* Tags */
    "tags.ofQuote": "Tags da citação", "tags.filterBy": "Filtrar pela tag {tag}", "tags.barAria": "Filtrar por tag", "tags.all": "Todas as tags",
    "tags.active": "Filtrando pela tag #{tag}", "tags.clear": "Limpar filtro de tag", "tags.unavailable": "As tags não puderam ser carregadas agora.",
    "tags.chipCount": "#{tag} ({n})",

    /* Coleções */
    "coll.label": "Coleção", "coll.all": "Todas as citações", "coll.manage": "Gerenciar coleções", "coll.title": "Coleções",
    "coll.newLabel": "Nova coleção", "coll.newPlaceholder": "Ex.: Para a resenha", "coll.create": "Criar", "coll.empty": "Você ainda não tem coleções.",
    "coll.rename": "Renomear", "coll.renameAria": "Renomear coleção {name}", "coll.renameLabel": "Novo nome da coleção {name}", "coll.save": "Salvar",
    "coll.delete": "Excluir", "coll.deleteAria": "Excluir coleção {name}", "coll.cancel": "Cancelar",
    "coll.confirmDelete": "Excluir a coleção “{name}”? As citações continuam salvas.",
    "coll.created": "Coleção criada.", "coll.renamed": "Coleção renomeada.", "coll.deleted": "Coleção excluída.",
    "coll.nameRequired": "Dê um nome à coleção.", "coll.nameTooLong": "O nome pode ter até {max} caracteres.",
    "coll.unavailable": "As coleções não puderam ser carregadas agora.", "coll.retry": "Tentar de novo",
    "coll.add": "Adicionar à coleção", "coll.addAria": "Adicionar citação de {author} a uma coleção", "coll.addTitle": "Coleções desta citação",
    "coll.addEmpty": "Crie uma coleção para organizar suas citações.", "coll.addCreate": "Criar coleção",
    "coll.added": "Adicionada a “{name}”.", "coll.removed": "Removida de “{name}”.", "coll.count": "({n})",
    "coll.updating": "Atualizando...", "coll.memberError": "Não foi possível atualizar a coleção.",

    /* Áudio */
    "audio.group": "Ouvir as citações", "audio.listen": "Ouvir", "audio.listenAria": "Ouvir citação de {author}",
    "audio.listenList": "Ouvir a lista", "audio.listenListAria": "Ouvir todas as citações desta lista, uma após a outra",
    "audio.pause": "Pausar", "audio.resume": "Continuar", "audio.next": "Próxima", "audio.stop": "Parar",
    "audio.speed": "Velocidade", "audio.progress": "Lendo {i} de {n}",     "audio.unsupported": "A leitura em voz alta não está disponível neste navegador.",
    "audio.noVoice": "Nenhuma voz em português disponível neste navegador.",
    "audio.announceStart": "Lendo citação de {author}.", "audio.announceQueue": "Lendo {i} de {n}: citação de {author}.",
    "audio.announcePaused": "Leitura pausada.", "audio.announceResumed": "Leitura retomada.", "audio.announceDone": "Leitura concluída.",
    "audio.announceStopped": "Leitura interrompida.", "audio.error": "A leitura em voz alta falhou. Tente de novo.",
    "audio.rate": "{rate}x", "audio.nothing": "Não há citações para ouvir.",
    "audio.cloudFallback": "Voz natural indisponível agora; usando a voz do navegador.",
    "audio.cloudQuota": "Limite da voz natural atingido por agora; usando a voz do navegador.",
    "audio.cloudCredit": "Voz natural gerada pelo Google Cloud.",
    "speech.author": "Autor: {author}.", "speech.work": "Obra: {work}.", "speech.page": "Página {page}.",

    /* Importação */
    "import.lead": "Traga citações de arquivos .md ou .txt (inclusive notas do Kindle), confira a prévia e salve só o que quiser.",
    "import.private": "Tudo que for importado entra como Privado. Você escolhe depois o que compartilhar.",
    "import.privateBadge": "Entra como Privada",
    "import.sourceTitle": "1. Escolha os arquivos ou cole o texto",
    "import.dropGroup": "Área para soltar arquivos", "import.dropText": "Arraste arquivos .md ou .txt para cá",
    "import.dropOr": "ou", "import.pickBtn": "Escolher arquivos", "import.dropHint": "Até 1 MB por arquivo. Vários arquivos de uma vez.",
    "import.pasteLabel": "Ou cole o texto aqui", "import.pasteHelp": "Citações em markdown, blocos separados por linha em branco, linhas “Texto — Autor”, notas do Kindle ou campos rotulados.",
    "import.pasteBtn": "Ler texto colado",
    "import.formatsSummary": "Formatos reconhecidos", "import.formatsIntro": "Exemplos do que o leitor entende. O que não puder ser lido entra na prévia como “precisa de revisão”.",
    "import.fmt1": "Blockquote markdown, com autor na linha seguinte:", "import.fmt1ex": "> A vida é o que acontece enquanto fazemos outros planos.\n— John Lennon, Entrevista, p. 12",
    "import.fmt2": "Bloco com aspas e autor:", "import.fmt2ex": "“Penso, logo existo.”\n— René Descartes, Discurso do Método, p. 33",
    "import.fmt3": "Uma linha por citação:", "import.fmt3ex": "Só sei que nada sei — Sócrates",
    "import.fmt4": "Kindle ou Notas:", "import.fmt4ex": "Dom Casmurro (Machado de Assis)\n- Seu destaque na página 12 | Posição 100\n\nCapitu tinha olhos de ressaca.",
    "import.fmt5": "Front matter e tags:", "import.fmt5ex": "---\ntitle: Grande Sertão\nauthor: Guimarães Rosa\ntags: [sertão, vida]\n---\n> Viver é muito perigoso. #risco",
    "import.fmt6": "Campos rotulados:", "import.fmt6ex": "Citação: Penso, logo existo.\nAutor: René Descartes\nObra: Discurso do Método\nPágina: 33\nReflexão: Base do racionalismo.\nTags: filosofia",
    "import.reading": "Lendo arquivos...", "import.noLib": "O leitor de importação não carregou. Recarregue a página.",
    "import.fileTooBig": "“{name}” passa de 1 MB e foi ignorado.", "import.fileType": "“{name}” não é um arquivo .md ou .txt e foi ignorado.",
    "import.fileRead": "Não foi possível ler “{name}”.", "import.fileNone": "Nenhuma citação encontrada em “{name}”.",
    "import.fileEncoding": "“{name}” pode não estar em UTF-8; confira os acentos na prévia.",
    "import.pasteEmpty": "Cole algum texto antes de ler.", "import.pasteNone": "Nenhuma citação encontrada no texto colado.",
    "import.ignored": "{n} linhas de estrutura (títulos ou marcadores sem texto) foram ignoradas em “{name}”.",
    "import.pasteName": "texto colado",
    "import.capped": "Só as primeiras {max} citações foram para a prévia. Importe o resto em outra rodada.",
    "import.parsed.one": "{n} citação encontrada.", "import.parsed.many": "{n} citações encontradas.",
    "import.previewTitle": "2. Confira a prévia", "import.selected": "{n} de {m} selecionadas",
    "import.selectAll": "Marcar todas", "import.selectNone": "Desmarcar todas", "import.selectRepeated": "Desmarcar repetidas",
    "import.warnReview.one": "{n} citação precisa de revisão (autor ou texto faltando).", "import.warnReview.many": "{n} citações precisam de revisão (autor ou texto faltando).",
    "import.warnDup.one": "{n} citação repetida neste lote.", "import.warnDup.many": "{n} citações repetidas neste lote.",
    "import.cardTitle": "Citação {n}", "import.include": "Incluir esta citação", "import.badgeReview": "Precisa de revisão",
    "import.badgeDup": "Repetida: igual à citação {n}", "import.badgeSource": "Origem: {name}",
    "import.badgeServer": "O servidor recusou: {reason}",
    "import.fText": "Trecho", "import.fAuthor": "Autor", "import.fWork": "Obra", "import.fPage": "Página", "import.fReflection": "Reflexão", "import.fTags": "Tags (separadas por vírgula)",
    "import.submit": "Importar {n} selecionadas", "import.submitNone": "Importar selecionadas", "import.submitting": "Importando...",
    "import.sending": "Enviando lote {i} de {n}...", "import.reset": "Recomeçar", "import.resetConfirm": "Confirmar: descartar a prévia",
    "import.fixFirst.one": "Corrija {n} citação selecionada antes de importar.", "import.fixFirst.many": "Corrija {n} citações selecionadas antes de importar.",
    "import.summaryTitle": "Resultado da importação", "import.sumCreated": "Criadas: {n}", "import.sumDup": "Puladas por duplicata: {n}",
    "import.sumInvalid": "Inválidas: {n}", "import.sumFailed": "Não enviadas: {n}", "import.toMine": "Ver em Minhas citações",
    "import.invalidListTitle": "Citações recusadas (continuam na prévia para correção):",
    "import.errUnavailable": "A importação ainda não está disponível no servidor. Nada foi salvo; tente de novo mais tarde.",
    "import.errBig": "O envio foi grande demais para o servidor. Desmarque algumas citações e tente de novo.",
    "import.errGeneric": "Não foi possível importar agora. As citações não enviadas continuam na prévia.",
    "import.noSelection": "Marque pelo menos uma citação.",
    "import.reasonDefault": "dados inválidos", "import.reasonInvalid": "dados inválidos", "import.reasonDuplicate": "citação repetida",
    "import.pasteTooBig": "O texto colado passa de 1 MB. Envie por arquivo ou cole em partes menores.",
    "import.errBigOne": "Uma citação sozinha é grande demais para o servidor. Reduza o texto e tente de novo.",
  },
};
if (window.I18N_EN) I18N.en = window.I18N_EN;

/* Idioma: ?lang= (pt|en) > localStorage "acervo-lang" > navigator.language (pt*, en*) > pt. */
const LANG_KEY = "acervo-lang";
const LANGS = ["pt", "en"];
function detectLang() {
  const ok = (v) => (LANGS.includes(v) && I18N[v] ? v : "");
  try {
    const p = new URLSearchParams(location.search);
    const q = ok(String(p.get("lang") || "").toLowerCase());
    if (p.has("lang")) {                   // consome o parâmetro e mantém o resto da URL (inclusive o hash)
      p.delete("lang");
      const rest = p.toString();
      history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
    }
    if (q) { try { localStorage.setItem(LANG_KEY, q); } catch (e) { /* ignora */ } return q; }
  } catch (e) { /* ignora */ }
  try { const v = ok(localStorage.getItem(LANG_KEY)); if (v) return v; } catch (e) { /* ignora */ }
  const nav = String((typeof navigator !== "undefined" && (navigator.language || (navigator.languages && navigator.languages[0]))) || "").toLowerCase();
  if (nav.startsWith("en") && I18N.en) return "en";
  return "pt";
}
let LANG = detectLang();
let S = I18N[LANG];
function setLangState(l) { if (LANGS.includes(l) && I18N[l]) { LANG = l; S = I18N[l]; } }

function t(key, vars) {
  let s = S[key];
  if (s == null) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
  return s;
}
/* Plural por chave: "chave.one" / "chave.many" (com {n}). */
function tn(key, n, vars) { return t(key + (n === 1 ? ".one" : ".many"), Object.assign({ n }, vars)); }

(function () {
  "use strict";

  const QI = window.QuoteImport || null;

  /* ---------- Estado ---------- */
  const state = {
    auth: "loading",            // loading | in | out | error
    user: null,
    route: { name: "", id: null },
    query: "",
    scope: "author",            // author | topic | all
    editing: null,              // citação em edição
    saving: false,
  };

  const lists = {
    minhas: { items: [], next: null, loaded: false, loading: false, error: "", vis: "all", tag: "", collection: "", token: 0, pendingDelete: null, openMenu: null },
    feed:   { items: [], next: null, loaded: false, loading: false, error: "", tag: "", token: 0 },
  };
  const tagsData = { items: [], loaded: false, loading: false, error: false };
  const coll = { items: [], loaded: false, loading: false, error: "", editing: null, deleting: null, focus: "", focusCid: null };
  const cache = new Map();      // id -> citação (para edição)
  const mineIds = new Set();    // ids de citações do usuário logado
  const NEXT_KEY = "acervo-next";
  function saveNext(hash) { try { sessionStorage.setItem(NEXT_KEY, hash); } catch (e) { /* ignora */ } }
  function dropNext() { try { sessionStorage.removeItem(NEXT_KEY); } catch (e) { /* ignora */ } }
  function takeNext() {
    try {
      const v = sessionStorage.getItem(NEXT_KEY);
      dropNext();
      return /^#\/(minhas|nova|feed|importar|editar\/\d+)$/.test(v || "") ? v : "";
    } catch (e) { return ""; }
  }
  const PAGE_SIZE = 20;
  const MAX = { text: 2000, author: 200, work: 300, reflection: 3000, tags: 8, tag: 30, collection: 60 };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Helpers de DOM (sem innerHTML) ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function icon(id) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#" + id);
    svg.append(use);
    return svg;
  }

  /* Textos estáticos do HTML: data-i18n="chave" e data-i18n-attr="atributo:chave;outro:chave". */
  function applyI18n() {
    document.documentElement.lang = t("meta.lang");
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const i = pair.indexOf(":");
        if (i > 0) el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
      });
    });
  }

  /* Textos dinâmicos (erros, avisos): setDyn guarda como recalcular o texto ao trocar de idioma. */
  const dyn = new Map();
  const msgText = (m) => (typeof m === "function" ? m() : m == null ? "" : String(m));
  function setDyn(el, fn) { const f = typeof fn === "function" ? fn : () => String(fn); dyn.set(el, f); el.textContent = f(); }
  function clearDyn(el) { if (el) dyn.delete(el); }
  function refreshDyn() { dyn.forEach((fn, el) => { if (!el.isConnected) dyn.delete(el); else if (!el.hidden) el.textContent = fn(); }); }

  /* Chave de comparação: minúsculas e sem acento, sempre 1 char por char original
     (mantém os índices alinhados para destacar o termo no texto original). */
  function normKey(s) {
    let out = "";
    for (const ch of String(s)) {
      const n = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      out += n.length === ch.length ? n : ch;
    }
    return out;
  }

  function appendHighlighted(parent, text, term) {
    const str = String(text == null ? "" : text);
    if (!term) { parent.append(document.createTextNode(str)); return; }
    const hay = normKey(str);
    let from = 0, i;
    while ((i = hay.indexOf(term, from)) !== -1) {
      if (i > from) parent.append(document.createTextNode(str.slice(from, i)));
      parent.append(h("mark", { class: "hit", text: str.slice(i, i + term.length) }));
      from = i + term.length;
    }
    if (from < str.length) parent.append(document.createTextNode(str.slice(from)));
  }

  function formatDate(v) {
    if (v == null || v === "") return "";
    let d;
    if (typeof v === "number") d = new Date(v < 1e12 ? v * 1000 : v);
    else {
      const s = String(v);
      d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(" ", "T") + "Z" : s);
    }
    if (isNaN(d)) return "";
    return d.toLocaleDateString(t("meta.locale"), { day: "numeric", month: "short" });
  }

  const normTag = (s) => (QI ? QI.normalizeTag(s) : String(s == null ? "" : s).normalize("NFC").trim().replace(/^#+/, "").toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 30).replace(/-+$/, ""));

  /* ---------- Avatar ---------- */
  const AV_COLORS = ["#2E3FA3", "#1F6B4A", "#8A3B7A", "#9A4A12", "#1F5F80", "#6B3FA0"];
  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  function fillAvatar(el, owner) {
    el.replaceChildren();
    const name = owner && owner.username ? owner.username : "?";
    let sum = 0;
    for (const c of String((owner && owner.userId) || name)) sum += c.charCodeAt(0);
    el.style.setProperty("--av", AV_COLORS[sum % AV_COLORS.length]);
    const fallback = () => { el.replaceChildren(document.createTextNode(initials(name))); };
    if (owner && owner.userId && owner.avatar) {
      const img = h("img", { alt: "", width: 64, height: 64, loading: "lazy", referrerpolicy: "no-referrer" });
      img.addEventListener("error", fallback, { once: true });
      img.src = "https://cdn.discordapp.com/avatars/" + encodeURIComponent(owner.userId) + "/" + encodeURIComponent(owner.avatar) + ".png?size=64";
      el.append(img);
    } else fallback();
  }
  function avatarEl(owner, small) {
    const el = h("span", { class: "avatar" + (small ? " avatar-sm" : ""), "aria-hidden": "true" });
    fillAvatar(el, owner);
    return el;
  }

  /* ---------- API ---------- */
  /* Mensagens do servidor chegam em português: texto -> chave i18n (com {n}); sem correspondência, vale o texto original. */
  const SRV = [
    [/^Não autenticado\.$/, "srv.unauth"], [/^Origem não permitida\.$/, "srv.origin"], [/^Método não permitido\.$/, "srv.method"],
    [/^Content-Type deve ser application\/json\.$/, "srv.contentType"], [/^Corpo da requisição grande demais\.$/, "srv.tooBig"],
    [/^Corpo inválido\.$/, "srv.badBody"], [/^O corpo deve ser um objeto JSON\.$/, "srv.notObject"], [/^JSON inválido\.$/, "srv.badJson"],
    [/^Parâmetro inválido\.$/, "srv.badParam"], [/^Tag inválida\.$/, "srv.badTag"], [/^Deve ser um inteiro positivo\.$/, "srv.posInt"], [/^Cursor inválido\.$/, "srv.badCursor"],
    [/^Erro interno ao consultar o acervo\.$/, "srv.errList"], [/^Erro interno ao consultar as tags\.$/, "srv.errTags"],
    [/^Erro interno ao processar a citação\.$/, "srv.errQuote"], [/^Erro interno ao salvar a citação\.$/, "srv.errSave"],
    [/^Erro interno ao importar as citações\.$/, "srv.errImport"], [/^Erro interno ao processar a coleção\.$/, "srv.errColl"], [/^Erro interno\.$/, "srv.errGeneric"],
    [/^Coleção não encontrada\.$/, "srv.collNotFound"], [/^Você não pode alterar a coleção de outro usuário\.$/, "srv.collForeign"],
    [/^Citação não encontrada\.$/, "srv.quoteNotFound"], [/^Você não pode alterar a citação de outro usuário\.$/, "srv.quoteForeign"],
    [/^Dados inválidos\.$/, "srv.invalidData"], [/^Use 'accepted' ou 'dismissed'\.$/, "srv.inviteAction"],
    [/^Envie uma lista com ao menos 1 item\.$/, "srv.itemsMin"], [/^Máximo de (\d+) itens por importação\.$/, "srv.itemsMax", "n"],
    [/^Você já tem uma coleção com esse nome\.$/, "srv.collDup"], [/^Nome já em uso\.$/, "srv.nameUsed"], [/^O nome é obrigatório\.$/, "srv.nameReq"],
    [/^Deve ser um texto\.$/, "srv.isText"], [/^O trecho é obrigatório\.$/, "srv.textReq"], [/^O autor é obrigatório\.$/, "srv.authorReq"],
    [/^Máximo de (\d+) caracteres\.$/, "val.tooLong", "max"],
    [/^A página deve ser um inteiro maior ou igual a 0\.$/, "srv.pageInt"], [/^Deve ser uma lista de tags\.$/, "srv.tagsList"],
    [/^Cada tag deve ter de 1 a (\d+) caracteres, só letras, números, _ ou -\.$/, "srv.tagFormat", "n"], [/^Máximo de (\d+) tags por citação\.$/, "srv.tagsMax", "n"],
    [/^Deve ser uma lista com até (\d+) ids\.$/, "srv.idsMax", "n"], [/^Cada id deve ser um inteiro positivo\.$/, "srv.idPos"],
    [/^Há citações inexistentes ou que não são suas\.$/, "srv.idsMissing"], [/^Use all, public ou private\.$/, "srv.visParam"], [/^Deve ser um objeto\.$/, "srv.isObject"],
    [/^not_found$/, "api.404"],
  ];
  function srv(msg) {
    const text = String(msg == null ? "" : msg);
    for (const [re, key, arg] of SRV) {
      const m = re.exec(text);
      if (m) return t(key, arg ? { [arg]: m[1] } : undefined);
    }
    return text;
  }

  class ApiError extends Error {
    constructor(status, raw, fields) { super(); this.status = status; this.raw = raw || ""; this.fields = fields || null; }
    /* Calculada na hora: continua certa se o idioma mudar com o erro na tela. */
    get message() { return this.raw ? srv(this.raw) : defaultMessage(this.status); }
  }

  async function api(path, opts) {
    const o = Object.assign({ credentials: "same-origin", headers: {} }, opts);
    o.headers = Object.assign({ Accept: "application/json" }, o.headers);
    if (o.body && typeof o.body !== "string") { o.body = JSON.stringify(o.body); o.headers["Content-Type"] = "application/json"; }
    let res;
    try { res = await fetch(path, o); }
    catch (e) { throw new ApiError(0, ""); }
    if (res.status === 204) return { ok: true };
    let data = null;
    try { data = await res.json(); } catch (e) { /* corpo não JSON */ }
    if (res.ok && data && data.ok !== false) return data;
    throw new ApiError(res.status, (data && typeof data.error === "string" && data.error) || "", data && data.fields);
  }

  function defaultMessage(status) {
    if (status === 0) return t("api.network");
    if (status === 401) return t("api.401");
    if (status === 403) return t("api.403");
    if (status === 404) return t("api.404");
    if (status === 400) return t("api.400");
    if (status >= 500) return t("api.5xx");
    return t("api.other");
  }

  /* Para recursos novos (tags, coleções, importação): 404/5xx viram aviso amigável. */
  function friendly(err, unavailableKey) {
    if (err.status === 404 || err.status === 405 || err.status >= 500) return t(unavailableKey || "api.unavailable");
    return err.message;
  }
  const friendlyFn = (err, unavailableKey) => () => friendly(err, unavailableKey);

  /* 401 em qualquer chamada: volta ao login. Devolve true se tratou. */
  function handle401(err) {
    if (err && err.status === 401) {
      stopSpeech();
      state.user = null; state.auth = "out"; state.me = null; setCloudFromMe(null);
      resetLists();
      updateChrome();
      showLogin({ message: () => t("login.expired") });
      return true;
    }
    return false;
  }

  /* ---------- Avisos ---------- */
  let toastTimer = 0;
  function toast(msg, isError) {
    const box = $("#toast");
    box.replaceChildren(h("div", { class: "toast" + (isError ? " error" : ""), text: msg }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.replaceChildren(), 5000);
  }

  /* ---------- Tema ---------- */
  function isDark() {
    const th = document.documentElement.getAttribute("data-theme");
    return th ? th === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function syncThemeBtn() {
    const btn = $("#themeBtn");
    const dark = isDark();
    btn.setAttribute("aria-pressed", String(dark));
    btn.setAttribute("aria-label", t("theme.label"));
    btn.querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
  }
  $("#themeBtn").addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("acervo-theme", next); } catch (e) { /* ignora */ }
    syncThemeBtn();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeBtn);

  /* ---------- Idioma (PT | EN) ---------- */
  function syncLangBtns() {
    $$("[data-lang-btn]").forEach((b) => {
      const l = b.dataset.langBtn;
      const on = l === LANG;
      b.setAttribute("aria-pressed", String(on));
      if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      b.setAttribute("aria-label", t(on ? "lang.current" : "lang.switch", { name: t("lang." + l) }));
    });
  }
  function syncSearchPlaceholders() {
    $$("[data-search-block='minhas'] [data-search-input]").forEach((i) => { i.placeholder = t("search.minePlaceholder"); });
  }

  /* Textos estáticos do HTML + tudo que o JS monta uma vez só. Roda na carga e a cada troca de idioma. */
  function applyStatic() {
    applyI18n();
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", t("meta.description"));
    syncThemeBtn(); syncMenuLabel(); syncLangBtns(); syncSearchPlaceholders();
    syncFormTexts(); renderFormTags(); updatePreview(); renderSaveStatus();
    setTitle();
    $("#impReset").textContent = imp.resetArmed ? t("import.resetConfirm") : t("import.reset");
  }

  /* Troca na hora, sem recarregar: preserva rota, filtros, busca, rascunho do formulário e prévia da importação. */
  function switchLang(next) {
    if (next === LANG || !LANGS.includes(next) || !I18N[next]) return;
    stopSpeech();                                         // cancela a fala em andamento
    setLangState(next);
    try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignora */ }
    applyStatic();
    if (speech.ok) {
      $$("[data-audio-bar]").forEach((slot) => slot.replaceChildren());
      Object.keys(audioBars).forEach((k) => delete audioBars[k]);
      buildAudioBars(); syncAudioUI();
    }
    for (const name of Object.keys(lists)) { renderList(name); renderTagBar(name); }
    if (coll.loaded) renderCollections();
    if (rp.open && rp.view !== "idle") renderRandomBody(false);
    renderImportNotes();
    if (imp.items.length) renderImportPreview(false); else refreshImportSummary();
    $("#impSubmitMsg").replaceChildren(); $("#impSubmitMsg").hidden = true;
    if (imp.lastRes && !$("#impSummary").hidden) renderImportSummary(imp.lastRes, true);
    refreshDyn();
    updateChrome();
    announce(t("lang.announce"));
  }
  $$("[data-lang-btn]").forEach((b) => b.addEventListener("click", () => switchLang(b.dataset.langBtn)));

  /* ---------- Cabeçalho ---------- */
  function updateChrome() {
    const inn = state.auth === "in" && state.user;
    $("#mainNav").hidden = !inn;
    $("#headerSearchForm").hidden = !inn;
    $("#userBox").hidden = !inn;
    $("#menuBtn").hidden = !inn;
    if (!inn) closeMenu();
    if (inn) {
      $("#userName").textContent = state.user.username || "";
      fillAvatar($("#userAvatar"), state.user);
    }
    $$("#mainNav a").forEach((a) => {
      const r = a.dataset.route;
      const cur = r === state.route.name || (r === "nova" && state.route.name === "editar");
      if (cur) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function syncMenuLabel() {
    const open = $("#mainNav").classList.contains("is-open");
    $("#menuBtn").setAttribute("aria-expanded", String(open));
    $("#menuBtn").setAttribute("aria-label", t(open ? "menu.close" : "menu.open"));
  }
  function closeMenu() {
    $("#mainNav").classList.remove("is-open");
    syncMenuLabel();
  }
  $("#menuBtn").addEventListener("click", () => {
    $("#mainNav").classList.toggle("is-open");
    syncMenuLabel();
  });
  $("#mainNav").addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });

  $("#logoutBtn").addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST" }); }
    catch (e) { if (e.status !== 401) { toast(e.message, true); return; } }
    stopSpeech();
    state.user = null; state.auth = "out"; state.me = null; setCloudFromMe(null);
    dropNext();
    resetLists(); setQuery(""); resetImport();
    updateChrome();
    if (location.hash === "#/" || location.hash === "") route(); else location.hash = "#/";
    toast(t("toast.bye"));
  });

  /* ---------- Botão Entrar com Discord (estado carregando) ---------- */
  function resetDiscordButtons() {
    $$("[data-discord-btn]").forEach((b) => {
      b.removeAttribute("aria-busy");
      const l = $("[data-label]", b);
      if (l && l.dataset.i18n) l.textContent = t(l.dataset.i18n);
    });
    $("#loginProgress").hidden = true;
  }
  $$("[data-discord-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = $("[data-label]", btn);
      l.textContent = t("discord.opening");
      btn.setAttribute("aria-busy", "true");
      $("#loginProgress").hidden = false;
    });
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) resetDiscordButtons(); });

  /* ---------- Roteamento ---------- */
  const PROTECTED = ["feed", "minhas", "nova", "editar", "importar"];
  const KNOWN = ["entrar", "feed", "minhas", "nova", "editar", "importar", "entrada"];

  function parseHash() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
    const name = parts[0] || "";
    if (name === "editar") return { name, id: /^\d+$/.test(parts[1] || "") ? Number(parts[1]) : null };
    return { name, id: null };
  }

  function showView(id) {
    $$(".view").forEach((v) => { v.hidden = v.id !== id; });
  }

  function route(opts) {
    if (state.auth === "loading") return;
    stopSpeech();                         // nunca deixa a fala atravessar telas
    const r = parseHash();
    const protectedRoute = PROTECTED.includes(r.name);
    const o = opts || {};

    if (r.name === "" || r.name === "entrada") {
      if (state.auth === "in") { location.replace("#/feed"); return; }
      r.name = "entrada";
    } else if (protectedRoute && state.auth !== "in") {
      if (state.auth === "out") saveNext(location.hash);
      state.route = { name: "entrar", id: null };
      showLogin({ message: state.auth === "error" ? () => t("login.verifyFail") : "", quiet: state.auth !== "error" });
      return;
    } else if (r.name === "entrar" && state.auth === "in") { location.replace("#/feed"); return; }
    else if (!KNOWN.includes(r.name)) {
      state.route = r; showView("view-404"); finishNav("title.404", o); return;
    }

    state.route = r;
    if (r.name === "entrada") { showView("view-entrada"); revealMarker($("#entradaMarker")); }
    else if (r.name === "entrar") { showView("view-login"); if (!o.keepLoginError) hideLoginError(); }
    else if (r.name === "feed") { showView("view-feed"); enterList("feed"); }
    else if (r.name === "minhas") { showView("view-minhas"); enterList("minhas"); }
    else if (r.name === "importar") { showView("view-importar"); enterImport(); }
    else if (r.name === "nova") { openForm(null); showView("view-nova"); }
    else if (r.name === "editar") {
      const q = cache.get(r.id);
      const mine = q && (mineIds.has(q.id) || (q.owner && state.user && q.owner.userId === state.user.userId));
      if (!q || !mine) { toast(q ? t("route.onlyOwnEdit") : t("route.openFromMine"), true); location.replace("#/minhas"); return; }
      openForm(q); showView("view-nova");
    }
    finishNav("title." + r.name, o);
  }

  function setTitle() {
    const k = state.titleKey || "title.entrada";
    document.title = k === "title.entrada" ? t("meta.homeTitle") : t(k) + t("meta.titleSuffix");
  }
  function finishNav(titleKey, o) {
    state.titleKey = titleKey;
    setTitle();
    updateChrome();
    if (o.first) return;
    const target = $(".view:not([hidden]) h1");
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", () => route());

  /* ---------- Login ---------- */
  function hideLoginError() { $("#loginError").hidden = true; }
  function showLogin(opts) {
    const o = opts || {};
    state.route = { name: "entrar", id: null };
    if (location.hash !== "#/entrar") {
      history.replaceState(null, "", "#/entrar");
    }
    showView("view-login");
    resetDiscordButtons();
    const box = $("#loginError");
    if (o.quiet) { box.hidden = true; clearDyn($("#loginErrorMsg")); clearDyn($("#loginErrorDetail")); }
    else {
      setDyn($("#loginErrorMsg"), () => msgText(o.message) || t("login.error"));
      const d = $("#loginErrorDetail");
      d.hidden = !o.detail;
      if (o.detail) setDyn(d, o.detail); else { clearDyn(d); d.textContent = ""; }
      box.hidden = false;
    }
    finishNav("title.entrar", { first: o.first });
  }

  /* ---------- Marca-texto: varredura via classe ---------- */
  function revealMarker(el) {
    if (!el) return;
    el.classList.remove("is-on");
    if (reduceMotion.matches) { el.classList.add("is-on"); return; }
    void el.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-on")));
  }

  /* ---------- Busca (no cliente) ---------- */
  function matchesQuery(q, term) {
    if (!term) return true;
    const inAuthor = () => normKey(q.author || "").includes(term);
    const inTopic = () => [q.text, q.reflection, q.work].some((f) => normKey(f || "").includes(term));
    if (state.scope === "author") return inAuthor();
    if (state.scope === "topic") return inTopic();
    return inAuthor() || inTopic();
  }
  const currentTerm = () => normKey(state.query.trim());

  function shortTerm(s) { const a = Array.from(s); return a.length > 40 ? a.slice(0, 40).join("").trimEnd() + "…" : s; }
  function activeListName() { return state.route.name === "minhas" ? "minhas" : state.route.name === "feed" ? "feed" : null; }

  const searchInputs = [];
  function setupSearch() {
    $$("[data-search-block]").forEach((slot) => {
      const frag = $("#searchTpl").content.cloneNode(true);
      const form = $("form", frag);
      const input = $("[data-search-input]", frag);
      slot.append(frag);
      searchInputs.push(input);
      bindSearchControls(form, input);
    });
    const hf = $("#headerSearchForm");
    const hi = $("#headerSearch");
    searchInputs.push(hi);
    /* Foco nunca troca de rota. Fora de feed/minhas, só o Enter leva ao feed (mantendo o termo). */
    hf.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!activeListName() && state.query.trim()) { state.carryQuery = true; location.hash = "#/feed"; }
    });
    hi.addEventListener("input", () => onSearchInput(hi));
  }

  function bindSearchControls(form, input) {
    form.addEventListener("submit", (e) => e.preventDefault());
    input.addEventListener("input", () => onSearchInput(input));
    $$("[data-scope]", form).forEach((b) => b.addEventListener("click", () => { setScope(b.dataset.scope); applyFilter(); }));
    $("[data-search-clear]", form).addEventListener("click", () => { setQuery(""); applyFilter(); input.focus(); });
  }

  let debounce = 0;
  function onSearchInput(src) {
    state.query = src.value;
    searchInputs.forEach((i) => { if (i !== src) i.value = state.query; });
    syncClearButtons();
    clearTimeout(debounce);
    debounce = setTimeout(applyFilter, 150);
  }
  function setQuery(v) {
    state.query = v;
    searchInputs.forEach((i) => { i.value = v; });
    syncClearButtons();
  }
  function syncClearButtons() { $$("[data-search-clear]").forEach((b) => { b.hidden = !state.query.trim(); }); }
  function setScope(s) {
    state.scope = s;
    $$("[data-scope]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scope === s)));
  }

  function applyFilter() {
    const name = activeListName();
    if (name) { stopSpeech(); renderList(name); }
  }

  /* ---------- Listas (Feed e Minhas) ---------- */
  function resetLists() {
    for (const k of Object.keys(lists)) Object.assign(lists[k], { items: [], next: null, loaded: false, loading: false, error: "", pendingDelete: null, token: lists[k].token + 1 });
    lists.minhas.openMenu = null;
    cache.clear(); mineIds.clear();
    tagsData.items = []; tagsData.loaded = false; tagsData.error = false;
    coll.items = []; coll.loaded = false; coll.error = "";
    for (const k of Object.keys(lists)) { $("#" + k + "-list").replaceChildren(); $("#" + k + "-state").replaceChildren(); $("#" + k + "-more").hidden = true; $("#" + k + "-count").textContent = ""; }
  }

  let lastList = null;
  function enterList(name) {
    if (lastList && lastList !== name && !state.carryQuery) setQuery("");
    state.carryQuery = false;
    lastList = name;
    syncClearButtons();
    if (name === "feed") closeRandom(false);
    const L = lists[name];
    if (!L.loaded && !L.loading) loadList(name, true);
    else renderList(name);
    if (name === "minhas") { loadTags(); loadCollections(); }
    renderTagBar(name);
    syncAudioUI();
  }

  async function loadList(name, reset) {
    const L = lists[name];
    if (L.loading && !reset) return;
    if (reset) stopSpeech();
    const token = ++L.token;
    L.loading = true; L.error = "";
    if (reset) { L.items = []; L.next = null; L.loaded = false; }
    renderList(name);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (!reset && L.next != null) params.set("cursor", String(L.next));
    if (name === "minhas") {
      params.set("visibility", L.vis);
      if (L.collection) params.set("collection", L.collection);
    }
    if (L.tag) params.set("tag", L.tag);
    try {
      const data = await api("/api/quotes/" + (name === "minhas" ? "mine" : "feed") + "?" + params);
      if (token !== L.token) return;
      const got = Array.isArray(data.quotes) ? data.quotes : [];
      got.forEach((q) => { cache.set(q.id, q); if (name === "minhas") mineIds.add(q.id); });
      L.items = L.items.concat(got);
      L.next = data.nextCursor == null ? null : data.nextCursor;
      L.loaded = true;
    } catch (err) {
      if (token !== L.token) return;
      L.loading = false;
      if (handle401(err)) return;
      L.error = (L.tag || L.collection) && (err.status === 404 || err.status >= 500) ? () => t("api.unavailable") : () => err.message;
    }
    L.loading = false;
    renderList(name);
  }

  function shownItems(name) {
    const term = currentTerm();
    return lists[name].items.filter((q) => matchesQuery(q, term));
  }

  function clearTagBtn(name) {
    return h("button", { class: "btn btn-secondary", type: "button", onclick: () => setListTag(name, lists[name].tag) }, t("list.clearFilter"));
  }

  function renderList(name) {
    const L = lists[name];
    const listEl = $("#" + name + "-list");
    const stateEl = $("#" + name + "-state");
    const more = $("#" + name + "-more");
    const count = $("#" + name + "-count");
    const term = currentTerm();

    const shown = shownItems(name);
    listEl.replaceChildren(...shown.map((q) => renderQuote(q, name, term)));

    stateEl.replaceChildren();
    more.hidden = !(L.loaded && L.next != null && !L.loading);
    more.disabled = false;

    if (L.loading && !L.items.length) {
      stateEl.append(h("div", { class: "skeleton", role: "status", "aria-label": t("list.loadingAria") }, h("span"), h("span"), h("span")));
      count.textContent = "";
      return;
    }
    if (L.loading) { more.hidden = false; more.disabled = true; more.textContent = t("list.loading"); }
    else more.textContent = t("list.more");

    if (L.error) {
      stateEl.append(h("div", { class: "state-box" },
        h("p", { class: "notice notice-error" }, icon("i-alert"), h("span", { text: msgText(L.error) })),
        h("button", { class: "btn btn-secondary", type: "button", onclick: () => loadList(name, !L.items.length) }, t("list.retry"))));
      count.textContent = "";
      return;
    }
    if (!L.loaded) return;

    if (!L.items.length) {
      count.textContent = "";
      const filtered = !!(L.tag || L.collection);
      if (name === "minhas") {
        stateEl.append(h("div", { class: "state-box" },
          h("p", { text: filtered ? t("list.emptyFiltered") : L.vis === "all" ? t("list.emptyMine") : L.vis === "public" ? t("list.emptyMinePublic") : t("list.emptyMinePrivate") }),
          L.tag ? clearTagBtn(name) : null,
          filtered ? null : h("a", { class: "btn btn-primary", href: "#/nova" }, t("list.newBtn"))));
      } else {
        stateEl.append(h("div", { class: "state-box" },
          h("p", { text: filtered ? t("list.emptyFiltered") : t("list.emptyFeed") }),
          L.tag ? clearTagBtn(name) : null));
      }
      return;
    }
    if (term) {
      count.textContent = shown.length
        ? tn("list.found", shown.length)
        : t("list.noMatch", { term: shortTerm(state.query.trim()) }) + (L.next != null ? t("list.loadMoreHint") : "");
    } else count.textContent = tn("list.count", L.items.length) + (L.next != null ? t("list.loadedSuffix") : "");
  }

  $("#minhas-more").addEventListener("click", () => loadList("minhas", false));
  $("#feed-more").addEventListener("click", () => loadList("feed", false));

  $$("#visFilter [data-vis]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.vis;
    if (lists.minhas.vis === v) return;
    lists.minhas.vis = v;
    $$("#visFilter [data-vis]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    loadList("minhas", true);
  }));

  /* ---------- Tags: chips, filtro e barra ---------- */
  function setListTag(name, tag) {
    const L = lists[name];
    L.tag = L.tag === tag ? "" : tag;
    renderTagBar(name);
    loadList(name, true);
  }

  function tagChips(tags, listName) {
    if (!Array.isArray(tags) || !tags.length) return null;
    const active = lists[listName] ? lists[listName].tag : "";
    return h("ul", { class: "tag-list", "aria-label": t("tags.ofQuote") },
      tags.map((tag) => h("li", {},
        h("button", { class: "tag-chip", type: "button", "aria-pressed": String(active === tag), "aria-label": t("tags.filterBy", { tag }), onclick: () => setListTag(listName, tag) }, "#" + tag))));
  }

  async function loadTags() {
    if (tagsData.loaded || tagsData.loading) { renderTagBar("minhas"); return; }
    tagsData.loading = true;
    try {
      const data = await api("/api/tags");
      tagsData.items = (Array.isArray(data.tags) ? data.tags : []).filter((x) => x && x.tag);
      tagsData.loaded = true; tagsData.error = false;
    } catch (err) {
      if (handle401(err)) return;
      tagsData.error = true; tagsData.loaded = true;
    }
    tagsData.loading = false;
    renderTagBar("minhas");
  }

  function renderTagBar(name) {
    const bar = $("#" + name + "-tagbar");
    if (!bar) return;
    const L = lists[name];
    bar.replaceChildren();
    if (name === "minhas" && tagsData.items.length) {
      const items = tagsData.items;
      const row = h("ul", { class: "tag-list tag-bar-list", "aria-label": t("tags.barAria") });
      row.append(h("li", {}, h("button", { class: "tag-chip", type: "button", "aria-pressed": String(!L.tag), onclick: () => { if (L.tag) setListTag(name, L.tag); } }, t("tags.all"))));
      items.forEach((x) => row.append(h("li", {},
        h("button", { class: "tag-chip", type: "button", "aria-pressed": String(L.tag === x.tag), onclick: () => setListTag(name, x.tag) }, x.count != null ? t("tags.chipCount", { tag: x.tag, n: x.count }) : "#" + x.tag))));
      bar.append(row);
    } else if (name === "minhas" && tagsData.error && !tagsData.items.length && L.tag) {
      bar.append(h("p", { class: "help-text", text: t("tags.unavailable") }));
    }
    if (L.tag && name === "feed") {
      bar.append(h("div", { class: "tag-active" },
        h("span", { text: t("tags.active", { tag: L.tag }) }),
        h("button", { class: "link-btn", type: "button", onclick: () => setListTag(name, L.tag) }, t("tags.clear"))));
    }
    bar.hidden = !bar.childNodes.length;
  }

  /* ---------- Coleções ---------- */
  const collCountOf = (c) => { const n = c.count != null ? c.count : c.quoteCount != null ? c.quoteCount : c.quotesCount; return typeof n === "number" ? n : null; };

  async function loadCollections(force) {
    if ((coll.loaded && !force) || coll.loading) { renderCollections(); return; }
    coll.loading = true;
    try {
      const data = await api("/api/collections");
      coll.items = (Array.isArray(data.collections) ? data.collections : []).filter((c) => c && c.id != null);
      coll.loaded = true; coll.error = "";
    } catch (err) {
      if (handle401(err)) return;
      coll.error = friendlyFn(err, "coll.unavailable"); coll.loaded = true; coll.items = [];
    }
    coll.loading = false;
    renderCollections();
  }

  /* Ordem alfabética sem diferenciar caixa (como o NOCASE do servidor), pelo idioma da interface. */
  function sortCollections() {
    const loc = t("meta.locale");
    coll.items.sort((a, b) => String(a.name).localeCompare(String(b.name), loc, { sensitivity: "accent" }) || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
  }

  function renderCollections() {
    sortCollections();
    const sel = $("#collSelect");
    const L = lists.minhas;
    const ok = !coll.error;
    $("#collRow").hidden = !ok;
    const st = $("#collState");
    st.replaceChildren();
    if (coll.error) {
      st.append(h("p", { class: "help-text", text: msgText(coll.error) }),
        h("button", { class: "link-btn", type: "button", onclick: () => loadCollections(true) }, t("coll.retry")));
    }
    st.hidden = ok;
    if (!ok) { $("#collPanel").hidden = true; return; }

    sel.replaceChildren(h("option", { value: "" }, t("coll.all")));
    coll.items.forEach((c) => {
      const n = collCountOf(c);
      sel.append(h("option", { value: String(c.id) }, c.name + (n != null ? " " + t("coll.count", { n }) : "")));
    });
    if (L.collection && !coll.items.some((c) => String(c.id) === L.collection)) L.collection = "";
    sel.value = L.collection;
    renderCollPanel();
  }

  $("#collSelect").addEventListener("change", (e) => {
    lists.minhas.collection = e.target.value;
    loadList("minhas", true);
  });
  $("#collManageBtn").addEventListener("click", () => {
    const panel = $("#collPanel");
    panel.hidden = !panel.hidden;
    $("#collManageBtn").setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) { renderCollPanel(); $("#collNewName").focus(); }
  });

  function collError(msg) {
    const e = $("#collErr");
    if (msg) setDyn(e, msg); else { clearDyn(e); e.textContent = ""; }
    e.hidden = !msg;
  }

  function renderCollPanel() {
    const ul = $("#collList");
    ul.replaceChildren();
    if (!coll.items.length) ul.append(h("li", { class: "help-text", text: t("coll.empty") }));
    coll.items.forEach((c) => {
      const li = h("li", { class: "coll-row", "data-cid": c.id });
      if (coll.editing === c.id) {
        const input = h("input", { type: "text", maxlength: MAX.collection, value: c.name, "aria-label": t("coll.renameLabel", { name: c.name }), autocomplete: "off" });
        input.value = coll.draft != null ? coll.draft : c.name;
        input.addEventListener("input", () => { coll.draft = input.value; });
        const f = h("form", { class: "coll-edit", novalidate: true },
          input,
          h("button", { class: "btn btn-primary btn-compact", type: "submit" }, t("coll.save")),
          h("button", { class: "btn btn-secondary btn-compact", type: "button", onclick: () => { coll.editing = null; coll.draft = null; coll.focus = "rename"; coll.focusCid = c.id; renderCollPanel(); } }, t("coll.cancel")));
        f.addEventListener("submit", (e) => { e.preventDefault(); renameCollection(c, input.value); });
        li.append(f);
      } else if (coll.deleting === c.id) {
        const cdel = h("div", { class: "confirm", role: "group", "aria-label": t("coll.deleteAria", { name: c.name }) },
          h("p", { text: t("coll.confirmDelete", { name: c.name }) }),
          h("div", { class: "confirm-actions" },
            h("button", { class: "btn btn-danger", type: "button", onclick: () => deleteCollection(c) }, t("coll.delete")),
            h("button", { class: "btn btn-secondary", type: "button", "data-role": "cancel-del", onclick: () => { coll.deleting = null; coll.focus = "delete"; coll.focusCid = c.id; renderCollPanel(); } }, t("coll.cancel"))));
        cdel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const b = $("[data-role=cancel-del]", cdel); if (b && !b.disabled) b.click(); } });
        li.append(cdel);
      } else {
        const n = collCountOf(c);
        li.append(h("span", { class: "coll-name" }, c.name, n != null ? h("span", { class: "muted", text: " " + t("coll.count", { n }) }) : null),
          h("span", { class: "coll-actions" },
            h("button", { class: "link-btn", type: "button", "data-role": "rename", "aria-label": t("coll.renameAria", { name: c.name }), onclick: () => { coll.editing = c.id; coll.deleting = null; coll.draft = null; coll.focus = "edit"; renderCollPanel(); } }, t("coll.rename")),
            h("button", { class: "link-btn danger", type: "button", "data-role": "delete", "aria-label": t("coll.deleteAria", { name: c.name }), onclick: () => { coll.deleting = c.id; coll.editing = null; coll.focus = "cancel-del"; renderCollPanel(); } }, t("coll.delete"))));
      }
      ul.append(li);
    });
    if (coll.focus === "edit") { const i = $(".coll-edit input", ul); if (i) i.focus(); }
    else if (coll.focus === "cancel-del") { const b = $("[data-role=cancel-del]", ul); if (b) b.focus(); }
    else if (coll.focus === "rename" || coll.focus === "delete") { const b = $("[data-cid='" + coll.focusCid + "'] [data-role=" + coll.focus + "]", ul); if (b) b.focus(); }
    coll.focus = "";
  }

  function validCollName(name) {
    const n = name.trim();
    if (!n) return () => t("coll.nameRequired");
    if (n.length > MAX.collection) return () => t("coll.nameTooLong", { max: MAX.collection });
    return "";
  }

  $("#collNewForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    collError("");
    const input = $("#collNewName");
    const bad = validCollName(input.value);
    if (bad) { collError(bad); input.focus(); return; }
    try {
      const data = await api("/api/collections", { method: "POST", body: { name: input.value.trim() } });
      input.value = "";
      if (data.collection) coll.items.push(data.collection); else await loadCollections(true);
      toast(t("coll.created"));
      renderCollections();
      input.focus();
    } catch (err) {
      if (handle401(err)) return;
      collError(friendlyFn(err, "coll.unavailable"));
    }
  });

  async function renameCollection(c, name) {
    collError("");
    const bad = validCollName(name);
    if (bad) { collError(bad); return; }
    try {
      const data = await api("/api/collections/" + encodeURIComponent(c.id), { method: "PUT", body: { name: name.trim() } });
      Object.assign(c, data.collection || { name: name.trim() });
      coll.editing = null; coll.draft = null; coll.focus = "";
      toast(t("coll.renamed"));
      renderCollections();
      const b = $("[data-cid='" + c.id + "'] [data-role=rename]"); if (b) b.focus();
    } catch (err) {
      if (handle401(err)) return;
      collError(friendlyFn(err, "coll.unavailable"));
    }
  }

  async function deleteCollection(c) {
    collError("");
    try {
      await api("/api/collections/" + encodeURIComponent(c.id), { method: "DELETE" });
      coll.items = coll.items.filter((x) => x.id !== c.id);
      coll.deleting = null;
      const wasActive = lists.minhas.collection === String(c.id);
      lists.minhas.items.forEach((q) => { if (Array.isArray(q.collectionIds)) q.collectionIds = q.collectionIds.filter((id) => id !== c.id); });
      toast(t("coll.deleted"));
      if (wasActive) { lists.minhas.collection = ""; loadList("minhas", true); }
      renderCollections();
      $("#collNewName").focus();
    } catch (err) {
      if (handle401(err)) return;
      collError(friendlyFn(err, "coll.unavailable"));
    }
  }

  /* Lê todos os ids de uma coleção (a API de membros recebe a lista completa). */
  async function fetchCollectionQuoteIds(id) {
    const ids = [];
    let cursor = null;
    for (let page = 0; page < 40; page++) {
      const p = new URLSearchParams({ limit: "50", collection: String(id) });
      if (cursor != null) p.set("cursor", String(cursor));
      const data = await api("/api/quotes/mine?" + p);
      (data.quotes || []).forEach((q) => ids.push(q.id));
      cursor = data.nextCursor;
      if (cursor == null) break;
    }
    return ids;
  }

  async function setMembership(c, q, add) {
    const ids = new Set(await fetchCollectionQuoteIds(c.id));
    if (add) ids.add(q.id); else ids.delete(q.id);
    await api("/api/collections/" + encodeURIComponent(c.id) + "/quotes", { method: "PUT", body: { quoteIds: Array.from(ids) } });
    const cur = new Set(Array.isArray(q.collectionIds) ? q.collectionIds : []);
    if (add) cur.add(c.id); else cur.delete(c.id);
    q.collectionIds = Array.from(cur);
    const n = collCountOf(c);
    if (n != null) { if (c.count != null) c.count = ids.size; else if (c.quoteCount != null) c.quoteCount = ids.size; }
  }

  function collMenu(q) {
    const status = h("p", { class: "help-text", role: "status", "aria-live": "polite" });
    const box = h("fieldset", { class: "coll-menu" }, h("legend", { text: t("coll.addTitle") }));
    if (coll.error) box.append(h("p", { class: "help-text", text: msgText(coll.error) }));
    else if (!coll.items.length) {
      box.append(h("p", { class: "help-text", text: t("coll.addEmpty") }),
        h("button", { class: "link-btn", type: "button", onclick: () => { const p = $("#collPanel"); p.hidden = false; $("#collManageBtn").setAttribute("aria-expanded", "true"); renderCollPanel(); $("#collNewName").focus(); } }, t("coll.addCreate")));
    } else {
      const has = new Set(Array.isArray(q.collectionIds) ? q.collectionIds : []);
      coll.items.forEach((c) => {
        const cb = h("input", { type: "checkbox" });
        cb.checked = has.has(c.id);
        cb.addEventListener("change", async () => {
          const want = cb.checked;
          $$("input", box).forEach((i) => { i.disabled = true; });
          status.textContent = t("coll.updating");
          try {
            await setMembership(c, q, want);
            status.textContent = t(want ? "coll.added" : "coll.removed", { name: c.name });
            if (!want && lists.minhas.collection === String(c.id)) {
              lists.minhas.items = lists.minhas.items.filter((x) => x.id !== q.id);
              lists.minhas.openMenu = null;
              renderList("minhas");
              toast(status.textContent);
              return;
            }
          } catch (err) {
            if (handle401(err)) return;
            cb.checked = !want;
            status.textContent = friendly(err, "coll.memberError");
          }
          $$("input", box).forEach((i) => { i.disabled = false; });
          renderCollections();
        });
        box.append(h("label", { class: "check-row" }, cb, h("span", { text: c.name })));
      });
    }
    box.append(status);
    return box;
  }

  /* ---------- Item de citação ---------- */
  function refLine(q, term) {
    const scope = state.scope;
    const hiAuthor = term && (scope === "author" || scope === "all") ? term : "";
    const hiTopic = term && (scope === "topic" || scope === "all") ? term : "";
    const p = h("p", { class: "ref" });
    appendHighlighted(p, q.author, hiAuthor);
    if (q.work) { p.append(", "); const em = h("em"); appendHighlighted(em, q.work, hiTopic); p.append(em); }
    if (q.page != null && q.page !== "") p.append(", " + t("quote.page", { page: q.page }));
    return p;
  }

  function listenButton(q, listName) {
    if (!speech.ok) return null;
    return h("button", {
      class: "btn-listen link-btn", type: "button", "data-id": q.id, "aria-pressed": "false",
      "aria-label": t("audio.listenAria", { author: q.author }), onclick: () => toggleListenOne(q, listName),
    }, h("span", { class: "speak-bars", "aria-hidden": "true" }, h("i"), h("i"), h("i")), t("audio.listen"));
  }

  function renderQuote(q, listName, term) {
    const hiTopic = term && (state.scope === "topic" || state.scope === "all") ? term : "";
    const text = h("p", { class: "quote-text" });
    appendHighlighted(text, q.text, hiTopic);
    const main = h("div", { class: "quote-main" }, h("blockquote", {}, text), refLine(q, term), tagChips(q.tags, listName));
    const grid = h("div", { class: "quote-grid" }, main);
    if (q.reflection) {
      const note = h("aside", { class: "margin-note", "aria-label": t("form.reflectionAria") });
      const np = h("p"); appendHighlighted(np, q.reflection, hiTopic); note.append(np);
      grid.append(note);
    }
    const art = h("article", { class: "quote", "data-id": q.id });
    if (speech.active && speech.queue[speech.qi] && speech.queue[speech.qi].id === q.id) art.classList.add("is-speaking");

    if (listName === "feed") {
      const when = formatDate(q.createdAt);
      art.append(h("div", { class: "byline" },
        avatarEl(q.owner, true),
        h("strong", { text: (q.owner && q.owner.username) || t("quote.someone") }),
        when ? h("span", { class: "muted", text: t("quote.sharedOn", { date: when }) }) : null));
    }
    art.append(grid);

    const listen = listenButton(q, listName);

    if (listName === "minhas") {
      const pub = q.visibility === "public";
      const L = lists.minhas;
      const menuOpen = L.openMenu === q.id;
      const meta = h("div", { class: "quote-meta" },
        h("span", { class: "badge" + (pub ? " public" : "") }, icon(pub ? "i-unlock" : "i-lock"), pub ? t("quote.public") : t("quote.private")),
        h("a", { class: "link-btn", href: "#/editar/" + q.id, "aria-label": t("quote.editAria", { author: q.author }) }, t("quote.edit")),
        h("button", { class: "link-btn", type: "button", "data-role": "coll", "aria-expanded": String(menuOpen), "aria-label": t("coll.addAria", { author: q.author }),
          onclick: () => { L.openMenu = menuOpen ? null : q.id; if (!coll.loaded) loadCollections(); renderList("minhas"); focusEl(".quote[data-id='" + q.id + "'] [data-role=coll]"); } }, t("coll.add")),
        listen,
        h("button", { class: "link-btn danger", type: "button", onclick: () => askDelete(q.id), "aria-label": t("quote.deleteAria", { author: q.author }) }, t("quote.delete")));
      art.append(meta);
      if (menuOpen) art.append(collMenu(q));
      if (L.pendingDelete === q.id) art.append(confirmBox(q));
    } else if (listen) {
      art.append(h("div", { class: "quote-meta" }, listen));
    }
    return art;
  }

  function confirmBox(q) {
    const err = h("p", { class: "field-error", hidden: true, role: "alert" });
    const del = h("button", { class: "btn btn-danger", type: "button" }, t("quote.delete"));
    const cancel = h("button", { class: "btn btn-secondary", type: "button", onclick: () => { lists.minhas.pendingDelete = null; renderList("minhas"); focusEl(".quote[data-id='" + q.id + "'] .link-btn.danger"); } }, t("coll.cancel"));
    del.addEventListener("click", async () => {
      del.disabled = true; cancel.disabled = true; del.textContent = t("quote.deleting");
      try {
        await api("/api/quotes/" + q.id, { method: "DELETE" });
        removeQuote(q.id);
        toast(t("quote.deleted"));
      } catch (e) {
        if (handle401(e)) return;
        if (e.status === 404) { removeQuote(q.id); toast(e.message, true); return; }
        del.disabled = false; cancel.disabled = false; del.textContent = t("quote.delete");
        err.hidden = false; err.textContent = e.status === 403 ? t("quote.onlyOwnDelete") : e.message;
      }
    });
    const box = h("div", { class: "confirm", role: "group", "aria-label": t("quote.confirmGroup") },
      h("p", { text: t("quote.confirmText") }),
      h("div", { class: "confirm-actions" }, del, cancel), err);
    box.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cancel.disabled) { e.preventDefault(); cancel.click(); } });
    return box;
  }
  function askDelete(id) {
    lists.minhas.pendingDelete = id;
    renderList("minhas");
    focusEl(".quote[data-id='" + id + "'] .confirm .btn-secondary");
  }
  function removeQuote(id) {
    // Só mexe na fala se a citação excluída estiver tocando ou na fila.
    let reload = false;
    const qIdx = speech.active ? speech.queue.findIndex((x) => x.id === id) : -1;
    if (qIdx >= 0) {
      if (speech.queue.length === 1) stopSpeech();
      else {
        speech.queue.splice(qIdx, 1);
        if (qIdx < speech.qi) speech.qi--;
        else if (qIdx === speech.qi) {
          speech.gen++; clearTimeout(speech.timer);
          haltOutput(true);
          speech.paused = false;
          if (speech.qi >= speech.queue.length) { stopSpeech(); announce(t("audio.announceDone")); }
          else reload = true;
        }
      }
    }
    for (const k of Object.keys(lists)) lists[k].items = lists[k].items.filter((x) => x.id !== id);
    cache.delete(id);
    lists.minhas.pendingDelete = null;
    tagsData.loaded = false; coll.loaded = false;
    renderList("minhas");
    if (reload) loadSpeechQuote(120); else if (speech.active) syncAudioUI();
    loadTags(); loadCollections();
    const hh = $("#minhas-h"); hh.setAttribute("tabindex", "-1"); hh.focus();
  }
  function focusEl(sel) { const el = $(sel); if (el) el.focus(); }

  /* ---------- Formulário (nova / editar) ---------- */
  const form = $("#quoteForm");
  const F = { text: $("#f-text"), author: $("#f-author"), work: $("#f-work"), page: $("#f-page"), reflection: $("#f-reflection"), tags: $("#f-tags") };
  const FIELD_NAMES = ["text", "author", "work", "page", "reflection", "tags", "visibility"];
  let formTags = [];

  function clearErrors() {
    $("#formError").hidden = true; clearDyn($("#formError"));
    FIELD_NAMES.forEach((n) => {
      const e = $("#f-" + n + "-err"); if (e) { clearDyn(e); e.hidden = true; e.textContent = ""; }
      const i = F[n]; if (i) i.removeAttribute("aria-invalid");
    });
  }
  function setFieldError(name, msg) {
    const e = $("#f-" + name + "-err"); if (!e) return false;
    setDyn(e, msg); e.hidden = false;
    if (F[name]) F[name].setAttribute("aria-invalid", "true");
    return true;
  }
  function getVisibility() { const r = form.querySelector("input[name=visibility]:checked"); return r ? r.value : "private"; }

  /* Campo de tags: Enter ou vírgula confirmam; Backspace no vazio remove a última. */
  function renderFormTags() {
    const ul = $("#f-tags-list");
    ul.replaceChildren(...formTags.map((tag) => h("li", {},
      h("span", { class: "tag-chip tag-chip-edit" }, "#" + tag,
        h("button", { type: "button", class: "tag-x", "aria-label": t("form.tagRemove", { tag }), onclick: () => { formTags = formTags.filter((x) => x !== tag); renderFormTags(); clearFieldError("tags"); F.tags.focus(); } }, "×")))));
    ul.hidden = !formTags.length;
    $("#f-tags-count").textContent = t("form.tagsCount", { n: formTags.length, max: MAX.tags });
    renderPreviewTags();
  }
  function addFormTags(raw) {
    let added = false;
    for (const part of String(raw).split(/[,;\n]/)) {
      const tag = normTag(part);
      if (!tag) continue;
      if (formTags.includes(tag)) continue;
      if (tag.length > MAX.tag) { setFieldError("tags", () => t("val.tagLong", { max: MAX.tag })); continue; }
      if (formTags.length >= MAX.tags) { setFieldError("tags", () => t("val.tagsMany", { max: MAX.tags })); break; }
      formTags.push(tag); added = true;
    }
    if (added) clearFieldError("tags");
    renderFormTags();
  }
  F.tags.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addFormTags(F.tags.value); F.tags.value = ""; }
    else if (e.key === "Backspace" && !F.tags.value && formTags.length) { formTags.pop(); renderFormTags(); }
  });
  F.tags.addEventListener("input", () => { if (/[,;\n]/.test(F.tags.value)) { addFormTags(F.tags.value); F.tags.value = ""; } });
  F.tags.addEventListener("blur", () => { if (F.tags.value.trim()) { addFormTags(F.tags.value); F.tags.value = ""; } });

  function openForm(q) {
    state.editing = q;
    clearErrors();
    $("#saveStatus").replaceChildren();
    F.text.value = q ? q.text || "" : "";
    F.author.value = q ? q.author || "" : "";
    F.work.value = q ? q.work || "" : "";
    F.page.value = q && q.page != null ? q.page : "";
    F.reflection.value = q ? q.reflection || "" : "";
    F.tags.value = "";
    formTags = q && Array.isArray(q.tags) ? q.tags.slice() : [];
    form.querySelector("input[name=visibility][value=" + (q && q.visibility === "public" ? "public" : "private") + "]").checked = true;
    state.justSaved = false;
    $("#saveBtn").disabled = false;
    syncFormTexts();
    renderFormTags();
    updatePreview();
  }
  /* Títulos e botão do formulário (nova x editar); também ao trocar de idioma. */
  function syncFormTexts() {
    const q = state.editing;
    $("#nova-h").textContent = q ? t("title.editar") : t("title.nova");
    $("#novaLead").textContent = q ? t("form.leadEdit") : t("form.leadNew");
    $("#saveBtn").textContent = state.saving ? t("form.saving") : q ? t("form.saveEdit") : t("form.save");
  }
  function renderSaveStatus() {
    const st = $("#saveStatus");
    st.replaceChildren();
    if (!state.justSaved) return;
    st.append(h("p", { class: "save-ok" }, icon("i-check"), t("form.saved")), h("a", { href: "#/minhas", text: t("form.viewMine") }));
  }

  function renderPreviewTags() {
    const ul = $("#pv-tags");
    ul.replaceChildren(...formTags.map((tag) => h("li", {}, h("span", { class: "tag-chip tag-chip-static" }, "#" + tag))));
    ul.hidden = !formTags.length;
  }

  function updatePreview() {
    const n = F.text.value.length;
    $("#f-text-count").textContent = n + " / " + MAX.text;
    const m = $("#pv-marker");
    m.textContent = F.text.value.trim() || t("form.previewEmpty");
    const ref = $("#pv-ref");
    ref.replaceChildren();
    const a = F.author.value.trim(), w = F.work.value.trim(), p = F.page.value.trim();
    if (a) ref.append(a);
    if (w) { if (a) ref.append(", "); ref.append(h("em", { text: w })); }
    if (p !== "") ref.append((a || w ? ", " : "") + t("quote.page", { page: p }));
    ref.hidden = !(a || w || p !== "");
    const r = F.reflection.value.trim();
    $("#pv-note").hidden = !r;
    $("#pv-reflection").textContent = r;
  }
  function clearFieldError(name) {
    const e = $("#f-" + name + "-err"); if (e) { clearDyn(e); e.hidden = true; e.textContent = ""; }
    if (F[name]) F[name].removeAttribute("aria-invalid");
  }
  Object.entries(F).forEach(([name, el]) => { if (name !== "tags") el.addEventListener("input", () => { updatePreview(); clearFieldError(name); }); });
  $$("input[name=visibility]", form).forEach((r) => r.addEventListener("change", () => clearFieldError("visibility")));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.saving) return;
    clearErrors();
    if (F.tags.value.trim()) { addFormTags(F.tags.value); F.tags.value = ""; }
    const body = {
      text: F.text.value.trim(), author: F.author.value.trim(), work: F.work.value.trim(),
      page: F.page.value.trim(), reflection: F.reflection.value.trim(), tags: formTags.slice(), visibility: getVisibility(),
    };
    const local = {};
    if (!body.text) local.text = () => t("val.textRequired");
    else if (body.text.length > MAX.text) local.text = () => t("val.tooLong", { max: MAX.text });
    if (!body.author) local.author = () => t("val.authorRequired");
    else if (body.author.length > MAX.author) local.author = () => t("val.tooLong", { max: MAX.author });
    if (body.work.length > MAX.work) local.work = () => t("val.tooLong", { max: MAX.work });
    if (body.reflection.length > MAX.reflection) local.reflection = () => t("val.tooLong", { max: MAX.reflection });
    if (body.page !== "" && !/^\d+$/.test(body.page)) local.page = () => t("val.pageInt");
    if (body.tags.length > MAX.tags) local.tags = () => t("val.tagsMany", { max: MAX.tags });
    if (Object.keys(local).length) { showFieldErrors(local); return; }

    state.saving = true;
    const btn = $("#saveBtn"); btn.disabled = true; syncFormTexts();
    const editing = state.editing;
    try {
      const data = await api(editing ? "/api/quotes/" + editing.id : "/api/quotes", { method: editing ? "PUT" : "POST", body });
      const q = data.quote;
      if (q) { cache.set(q.id, q); mineIds.add(q.id); }
      resetListsKeepCache();
      if (editing) { toast(t("form.updated")); location.hash = "#/minhas"; }
      else {
        openForm(null);
        state.justSaved = true;
        renderSaveStatus();
        F.text.focus();
      }
    } catch (err) {
      if (handle401(err)) return;
      if (err.status === 400 && err.fields) showFieldErrors(err.fields, () => err.message);
      else if (err.status === 403) showFormError(() => t("form.onlyOwnEdit"));
      else if (err.status === 404) { toast(err.message, true); location.hash = "#/minhas"; }
      else showFormError(() => err.message);
    } finally {
      state.saving = false;
      btn.disabled = false;
      syncFormTexts();
    }
  });

  function showFormError(msg) {
    const box = $("#formError"); setDyn(box, msg); box.hidden = false; box.focus && box.setAttribute("tabindex", "-1"); box.focus();
  }
  function showFieldErrors(fields, fallback) {
    let first = null, orphan = [];
    for (const name of FIELD_NAMES) {
      if (fields[name] && setFieldError(name, typeof fields[name] === "function" ? fields[name] : () => srv(fields[name])) && !first) first = F[name] || form.querySelector("input[name=visibility]");
    }
    for (const k of Object.keys(fields)) if (!FIELD_NAMES.includes(k)) orphan.push(fields[k]);
    if (orphan.length) showFormError(() => orphan.map((v) => srv(v)).join(" "));
    else if (!first && fallback) showFormError(fallback);
    if (first) first.focus();
  }
  /* Após salvar, as listas ficam desatualizadas: recarregam ao serem abertas. */
  function resetListsKeepCache() {
    for (const k of Object.keys(lists)) { lists[k].loaded = false; lists[k].items = []; lists[k].next = null; lists[k].token++; }
    tagsData.loaded = false; coll.loaded = false;
  }

  /* ---------- Citação aleatória ---------- */
  const rp = { open: false, token: 0, quote: null, view: "idle", errFn: null };
  function openRandom() {
    rp.open = true;
    $("#randomPanel").hidden = false;
    $("#randomBtn").setAttribute("aria-expanded", "true");
    $("#randomPanel").focus();
    drawRandom();
  }
  function closeRandom(restoreFocus) {
    if (!rp.open) return;
    stopSpeech();
    rp.open = false; rp.token++;
    $("#randomPanel").hidden = true;
    $("#randomBtn").setAttribute("aria-expanded", "false");
    if (restoreFocus) $("#randomBtn").focus();
  }
  /* Desenha o corpo do painel a partir de rp.view (também ao trocar de idioma, sem novo sorteio). */
  function renderRandomBody(reveal) {
    const body = $("#randomBody");
    if (rp.view === "loading") {
      body.classList.remove("has-quote");
      body.replaceChildren(h("div", { class: "skeleton", role: "status", "aria-label": t("random.drawing") }, h("span"), h("span"), h("span")));
    } else if (rp.view === "empty") {
      body.classList.remove("has-quote");
      body.replaceChildren(h("p", { text: t("random.empty") }));
    } else if (rp.view === "error") {
      body.classList.remove("has-quote");
      body.replaceChildren(h("p", { class: "notice notice-error" }, icon("i-alert"), h("span", { text: rp.errFn() })));
    } else if (rp.view === "quote" && rp.quote) {
      const q = rp.quote;
      const marker = h("span", { class: "marker", text: q.text });
      const when = formatDate(q.createdAt);
      const who = q.owner && q.owner.username;
      const main = h("div", { class: "rq-main" },
        h("blockquote", {}, h("p", { class: "quote-lg" }, marker)),
        refLine(q, ""),
        tagChipsStatic(q.tags),
        who ? h("p", { class: "small muted", text: when ? t("quote.sharedByOn", { name: who, date: when }) : t("quote.sharedBy", { name: who }) }) : null);
      const kids = [main];
      if (q.reflection) kids.push(h("aside", { class: "margin-note", "aria-label": t("form.reflectionAria") }, h("p", { text: q.reflection })));
      body.classList.add("has-quote");
      body.replaceChildren(...kids);
      if (reveal) revealMarker(marker); else marker.classList.add("is-on");
    }
  }
  async function drawRandom() {
    stopSpeech();
    const body = $("#randomBody");
    const token = ++rp.token;
    rp.quote = null;
    rp.view = "loading";
    body.setAttribute("aria-busy", "true");
    renderRandomBody();
    $("#randomAgain").disabled = true;
    syncRandomListen();
    try {
      const data = await api("/api/quotes/random");
      if (token !== rp.token) return;
      const q = data.quote;
      if (!q) { rp.view = "empty"; renderRandomBody(); return; }
      rp.quote = q; rp.view = "quote";
      renderRandomBody(true);
    } catch (err) {
      if (token !== rp.token) return;
      if (handle401(err)) return;
      rp.view = "error";
      rp.errFn = () => (err.status === 0 || err.status >= 500 || !err.status ? t("random.error") : err.message);
      renderRandomBody();
    } finally {
      if (token === rp.token) { body.setAttribute("aria-busy", "false"); $("#randomAgain").disabled = false; syncRandomListen(); }
    }
  }
  function tagChipsStatic(tags) {
    if (!Array.isArray(tags) || !tags.length) return null;
    return h("ul", { class: "tag-list", "aria-label": t("tags.ofQuote") }, tags.map((tag) => h("li", {}, h("span", { class: "tag-chip tag-chip-static" }, "#" + tag))));
  }
  $("#randomBtn").addEventListener("click", () => { if (rp.open) { closeRandom(true); } else openRandom(); });
  $("#randomAgain").addEventListener("click", drawRandom);
  $("#randomClose").addEventListener("click", () => closeRandom(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && rp.open) { e.preventDefault(); closeRandom(true); } });

  /* ---------- Áudio: ouvir as citações (Web Speech API) ---------- */
  const RATES = [0.75, 1, 1.25, 1.5];
  const RATE_KEY = "acervo-speech-rate";
  const speech = {
    browser: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,   // voz do navegador
    cloud: false,                                                                   // voz em nuvem liberada por /api/me
    ok: false,
    engine: "browser", noticed: false, noticeKey: "", blockedUntil: 0, audio: null, url: "", hasSrc: false, playGen: 0, unlocked: false,
    rate: 1, qlang: "", queue: [], qi: -1, chunks: [], ci: 0, active: false, paused: false, gen: 0, source: "", utter: null, timer: 0,
  };
  speech.ok = speech.browser;
  try { const r = parseFloat(localStorage.getItem(RATE_KEY)); if (RATES.includes(r)) speech.rate = r; } catch (e) { /* ignora */ }

  /* Divide em frases curtas: o Chrome corta falas longas (~15 s). */
  function speechChunks(str, max) {
    max = max || 170;
    const out = [];
    const flat = String(str).replace(/\s*\n+\s*/g, ". ").replace(/\s+/g, " ").trim();
    const sentences = flat.match(/[^.!?…]+[.!?…]+["”’»)]*\s*|[^.!?…]+$/g) || [flat];
    for (let s of sentences) {
      s = s.trim();
      while (s.length > max) {
        let cut = s.lastIndexOf(",", max);
        if (cut < 40) cut = s.lastIndexOf(" ", max);
        if (cut < 1) cut = max;
        out.push(s.slice(0, cut + 1).trim());
        s = s.slice(cut + 1).trim();
      }
      if (s) out.push(s);
    }
    return out.filter(Boolean);
  }
  /* Atribuição falada no idioma do TEXTO (lang = "pt" | "en"), lida direto de I18N, não do idioma da interface. */
  function tIn(lang, key, vars) {
    let s = (I18N[lang] || S)[key];
    if (s == null) s = S[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
    return s;
  }
  function quoteChunks(q, lang) {
    const parts = [q.text];
    if (q.author) parts.push(tIn(lang, "speech.author", { author: q.author }));
    if (q.work) parts.push(tIn(lang, "speech.work", { work: q.work }));
    if (q.page != null && q.page !== "") parts.push(tIn(lang, "speech.page", { page: q.page }));
    return parts.flatMap((p) => speechChunks(p));
  }

  /* CLOUD:BEGIN (funções puras, testáveis em Node) */
  const TTS_MAX = 1500;
  class TtsError extends Error {
    constructor(status, why) { super("tts " + status); this.status = status; this.why = why || ""; }
  }
  /* Texto da citação (+ autor, obra, página) para a voz em nuvem: uma peça só; se passar de max, frases agrupadas. */
  function packTts(parts, max) {
    max = max || TTS_MAX;
    const norm = parts.filter((p) => p != null && String(p).trim() !== "")
      .map((p) => String(p).replace(/\s*\n+\s*/g, ". ").replace(/\s+/g, " ").trim())
      .map((p) => (/[.!?…"”’»)]$/.test(p) ? p : p + "."));
    const text = norm.join(" ");
    if (text.length <= max) return text ? [text] : [];
    const out = []; let cur = "";
    for (const s of speechChunks(text, max)) {
      if (cur && cur.length + 1 + s.length > max) { out.push(cur); cur = s; }
      else cur = cur ? cur + " " + s : s;
    }
    if (cur) out.push(cur);
    return out;
  }
  /* Qual aviso mostrar (uma vez por sessão) quando a nuvem falha. */
  function ttsNoticeKey(err, already) {
    if (already) return "";
    return err && err.status === 429 ? "audio.cloudQuota" : "audio.cloudFallback";
  }
  const TTS_BLOCK_MS = 120000;                     // após falha, não insiste na nuvem por 2 min
  const cloudUsable = (me, blockedUntil, now) => !!me && me.tts === true && now >= blockedUntil;
  /* Cliente: fetch -> Blob, cache LRU pequeno (lang|rate|text), requisições em voo compartilhadas e abortáveis. */
  function createTtsClient(fetchFn, maxEntries) {
    maxEntries = maxEntries || 20;
    const cache = new Map(), inflight = new Map(), ctrls = new Set();
    const remember = (k, blob) => { cache.delete(k); cache.set(k, blob); while (cache.size > maxEntries) cache.delete(cache.keys().next().value); };
    async function request(text, lang, rate, signal) {
      let res, blob;
      try {
        res = await fetchFn("/api/tts", {
          method: "POST", credentials: "same-origin", signal,
          headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text, lang, rate }),
        });
        if (!res.ok) throw new TtsError(res.status);
        blob = await res.blob();
      } catch (e) {
        if (e instanceof TtsError || (e && e.name === "AbortError")) throw e;
        throw new TtsError(0, "network");
      }
      if (!blob || !blob.size) throw new TtsError(502, "empty");
      return blob;
    }
    function get(text, lang, rate) {
      const k = lang + "|" + rate + "|" + text;
      if (cache.has(k)) { const b = cache.get(k); remember(k, b); return Promise.resolve(b); }
      if (inflight.has(k)) return inflight.get(k);
      const ctrl = new AbortController();
      ctrls.add(ctrl);
      const p = request(text, lang, rate, ctrl.signal).then((b) => { remember(k, b); return b; })
        .finally(() => { inflight.delete(k); ctrls.delete(ctrl); });
      inflight.set(k, p);
      return p;
    }
    return { get, abortAll() { for (const c of Array.from(ctrls)) c.abort(); }, cache, inflight };
  }
  /* CLOUD:END */

  /* VOICES:BEGIN (funções puras, testáveis em Node) */
  /* Uma única voz automática por idioma; não há escolha do usuário. */
  /* Vozes de novidade do macOS: nunca escolhidas, mesmo sendo pt-BR (ex.: Eddy). */
  const NOVELTY_VOICES = new Set(["eddy", "flo", "grandma", "grandpa", "reed", "rocko", "sandy", "shelley", "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "good news", "jester", "organ", "superstar", "trinoids", "whisper", "wobble", "zarvox", "fred", "kathy", "ralph", "junior", "irving"]);
  /* Vozes boas conhecidas, por idioma, em ordem de preferência (abaixo das naturais). */
  const PREFERRED_VOICES = {
    pt: ["google", "francisca", "antonio", "felipe", "luciana", "fernanda", "thalita", "camila", "vitoria", "microsoft"],
    en: ["google us english", "samantha", "ava", "allison", "aria", "jenny", "google uk english female", "daniel", "karen", "serena", "microsoft"],
  };
  /* Nomes que indicam voz neural/aprimorada. */
  const NATURAL_RE = /natural|neural|online|premium|aprimorada|enhanced|\bsiri\b/i;
  /* "Eddy (Português (Brasil))" -> "eddy" */
  const voiceBase = (v) => String(v.name || "").replace(/\s*\(.*$/, "").trim().toLowerCase();
  const isNovelty = (v) => NOVELTY_VOICES.has(voiceBase(v));
  const isNatural = (v) => NATURAL_RE.test(String(v.name || ""));
  const voiceLang = (v) => String(v.lang || "").replace("_", "-").toLowerCase();
  /* 0 = natural, 1 = conhecida (pela ordem), 2 = demais. */
  function voiceRank(v, base) {
    if (isNatural(v)) return [0, 0];
    const name = String(v.name || "").toLowerCase();
    const i = (PREFERRED_VOICES[base] || []).findIndex((p) => name.includes(p));
    return i >= 0 ? [1, i] : [2, 0];
  }
  /* Vozes elegíveis: sem novidade; se houver alguma da região exata (pt-BR), só ela (nunca pt-PT por engano). */
  function voicesForLang(all, lang) {
    lang = String(lang).toLowerCase();
    const base = lang.split("-")[0];
    const sameBase = (all || []).filter((v) => voiceLang(v).split("-")[0] === base && !isNovelty(v));
    const exact = sameBase.filter((v) => voiceLang(v) === lang);
    return exact.length ? exact : sameBase;
  }
  /* A voz única do idioma: natural > conhecida > demais; local antes de remota; ordem original desempata. */
  function bestVoice(all, lang) {
    const base = String(lang).toLowerCase().split("-")[0];
    const keyed = voicesForLang(all, lang).map((v, i) => ({ v, i, r: voiceRank(v, base) }));
    keyed.sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || (b.v.localService === true) - (a.v.localService === true) || a.i - b.i);
    return keyed.length ? keyed[0].v : null;
  }
  /* Idioma do texto: "pt" | "en" | null (curto, ambíguo ou empatado => quem chama usa o idioma da interface). */
  const STOP_PT = new Set("de que não nao uma para com os é e se do da em por mais um na nas nos ao aos pelo pela já eu você mas como foi são ser tem muito sua seu há ou quando mesmo também ainda só sem sobre entre isso isto esta este essa esse lhe nem tudo todo todos tão cada onde porque".split(" "));
  const STOP_EN = new Set("i am my the and of to is that it you for with not be are was this but have from by at an your what who will can they we he she his her their there which if or as all so no more when would about into than them been has had do does".split(" "));
  function detectTextLang(text) {
    const s = String(text == null ? "" : text).slice(0, 4000).toLowerCase();
    const words = s.match(/\p{L}+/gu) || [];
    if (words.length < 3) return null;
    let pt = 0, en = 0;
    for (const w of words) {
      if (STOP_PT.has(w)) pt++;
      if (STOP_EN.has(w)) en++;
    }
    pt += 2 * (s.match(/[ãõç]/g) || []).length + (s.match(/[áàâêôéíóú]/g) || []).length;
    if (Math.max(pt, en) < 2 || Math.abs(pt - en) < 2) return null;
    return pt > en ? "pt" : "en";
  }
  const SPEECH_REGION = { pt: "pt-BR", en: "en-US" };
  /* Voz da citação: idioma do texto; sem voz dele, a do idioma da interface. Devolve {voice, lang (BCP-47)}. */
  function resolveSpeech(all, textLang, uiLang) {
    const order = [textLang, uiLang].filter((l, i, a) => l && a.indexOf(l) === i);
    for (const l of order) { const v = bestVoice(all, SPEECH_REGION[l] || l); if (v) return { voice: v, lang: SPEECH_REGION[l] || l }; }
    return { voice: null, lang: SPEECH_REGION[uiLang] || uiLang };
  }
  /* VOICES:END */

  /* Escolhas antigas do seletor de voz foram abandonadas: limpa e nunca mais grava. */
  try { ["acervo-speech-voice", "acervo-speech-voice-pt", "acervo-speech-voice-en"].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignora */ }
  const allVoices = () => (speechSynthesis.getVoices ? speechSynthesis.getVoices() : []);
  const uiLang = () => (LANG === "en" ? "en" : "pt");
  const quoteLang = (q) => detectTextLang(q && q.text) || uiLang();
  /* Chama cb quando as vozes existirem (evento voiceschanged) ou após o limite, o que ocorrer primeiro. */
  function whenVoices(cb, max) {
    if (!speechSynthesis.addEventListener || allVoices().length) { cb(); return; }
    let done = false;
    const fin = () => { if (done) return; done = true; clearTimeout(tm); speechSynthesis.removeEventListener("voiceschanged", fin); cb(); };
    const tm = setTimeout(fin, max == null ? 1500 : max);
    speechSynthesis.addEventListener("voiceschanged", fin);
  }

  function announce(msg) {
    const live = $("#audioLive");
    live.textContent = "";
    setTimeout(() => { live.textContent = msg; }, 30);
  }

  /* ---- Voz em nuvem (Google Cloud TTS via /api/tts): um <audio> reaproveitado, blobs, pré-carga de 1 à frente ---- */
  const tts = createTtsClient((u, o) => fetch(u, o), 20);
  const ttsLang = () => speech.qlang || uiLang();
  const cloudPieces = (q, lang) => packTts([q.text, q.author && tIn(lang, "speech.author", { author: q.author }),
    q.work && tIn(lang, "speech.work", { work: q.work }), q.page != null && q.page !== "" && tIn(lang, "speech.page", { page: q.page })]);
  let silentUrl = "";
  function silentWav() {            // 0,1 s de silêncio: "destrava" o autoplay dentro do clique (blob: é permitido pela CSP)
    if (silentUrl) return silentUrl;
    const n = 800, b = new DataView(new ArrayBuffer(44 + n));
    const w = (o, str) => { for (let i = 0; i < str.length; i++) b.setUint8(o + i, str.charCodeAt(i)); };
    w(0, "RIFF"); b.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true);
    b.setUint16(22, 1, true); b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true);
    w(36, "data"); b.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
    silentUrl = URL.createObjectURL(new Blob([b.buffer], { type: "audio/wav" }));
    return silentUrl;
  }
  function revokeUrl() { if (speech.url) { try { URL.revokeObjectURL(speech.url); } catch (e) { /* ignora */ } speech.url = ""; } }
  function ensureAudio() {
    if (speech.audio) return speech.audio;
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("ended", () => {
      if (!speech.hasSrc || speech.playGen !== speech.gen) return;
      speech.hasSrc = false; revokeUrl();
      speech.ci++;
      if (speech.ci < speech.chunks.length) speakChunk(); else advanceQuote(true);
    });
    a.addEventListener("error", () => {
      if (!speech.hasSrc || speech.playGen !== speech.gen) return;
      cloudFail(new TtsError(0, "media"));
    });
    speech.audio = a;
    return a;
  }
  function unlockAudio() {
    if (speech.unlocked) return;
    speech.unlocked = true;
    try { const a = ensureAudio(); a.src = silentWav(); const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignora */ }
  }
  function stopAudioEl() {
    speech.hasSrc = false;
    const a = speech.audio;
    if (a) { try { a.pause(); a.removeAttribute("src"); a.load(); } catch (e) { /* ignora */ } }
    revokeUrl();
  }
  /* Interrompe qualquer saída (nuvem e navegador). abort: cancela também as requisições. */
  function haltOutput(abort) {
    if (abort) tts.abortAll();
    stopAudioEl();
    try { speechSynthesis.cancel(); } catch (e) { /* ignora */ }
  }
  function prefetchNext() {
    let text = speech.chunks[speech.ci + 1], lang = ttsLang();
    if (text == null) { const nq = speech.queue[speech.qi + 1]; if (!nq) return; text = cloudPieces(nq, quoteLang(nq))[0]; lang = quoteLang(nq); }
    if (text) tts.get(text, lang, speech.rate).catch(() => {});
  }
  function cloudSpeak() {
    const gen = ++speech.gen;
    speech.hasSrc = false;
    tts.get(speech.chunks[speech.ci], ttsLang(), speech.rate).then((blob) => {
      if (gen !== speech.gen || !speech.active || speech.paused || speech.engine !== "cloud") return;
      revokeUrl();
      speech.url = URL.createObjectURL(blob);
      const a = ensureAudio();
      a.src = speech.url; a.defaultPlaybackRate = 1; a.playbackRate = 1;   // a velocidade já vem do servidor
      speech.hasSrc = true; speech.playGen = gen;
      const p = a.play();
      if (p && p.catch) p.catch((e) => { if (gen !== speech.gen || (e && e.name === "AbortError")) return; cloudFail(new TtsError(0, (e && e.name) || "play")); });
      prefetchNext();
    }, (err) => {
      if (gen !== speech.gen || (err && err.name === "AbortError")) return;
      cloudFail(err);
    });
  }
  /* A nuvem falhou: cai para a voz do navegador (uma vez por sessão avisa na barra e no aria-live). Nunca fica mudo sem aviso. */
  function cloudFail(err) {
    if (!speech.active || speech.engine !== "cloud") return;
    speech.blockedUntil = Date.now() + TTS_BLOCK_MS;
    const key = ttsNoticeKey(err, speech.noticed);
    haltOutput(true);
    speech.gen++;
    if (key) speech.noticed = true;
    if (!speech.browser) { stopSpeech(); announce(t(key || "audio.error")); return; }
    speech.engine = "browser";
    if (key) { speech.noticeKey = key; announce(t(key)); }
    const q = speech.queue[speech.qi];
    speech.chunks = quoteChunks(q, speech.qlang); speech.ci = 0;
    syncAudioUI();
    speakSoon(60);
  }

  function speakChunk() {
    if (!speech.active || speech.paused) return;
    if (speech.engine === "cloud") { cloudSpeak(); return; }
    browserSpeak();
  }
  function browserSpeak() {
    const gen = ++speech.gen;
    whenVoices(() => {
      if (gen !== speech.gen || !speech.active || speech.paused) return;   // parou/pausou/trocou idioma enquanto esperava
      const r = resolveSpeech(allVoices(), speech.qlang, uiLang());
      const v = r.voice, lang = r.lang;
      // Há vozes, mas nenhuma do idioma: não fala com a voz padrão de outro idioma.
      if (!v && allVoices().length) { stopSpeech(); announce(t("audio.noVoice")); return; }
      const u = new SpeechSynthesisUtterance(speech.chunks[speech.ci]);
      u.lang = v ? v.lang : lang;
      if (v) u.voice = v;
      u.rate = speech.rate;
      u.onend = () => { if (gen !== speech.gen) return; speech.ci++; if (speech.ci < speech.chunks.length) speakChunk(); else advanceQuote(true); };
      u.onerror = (ev) => {
        if (gen !== speech.gen || ev.error === "interrupted" || ev.error === "canceled") return;
        stopSpeech(); announce(t("audio.error"));
      };
      speech.utter = u;                      // referência viva: evita coleta de lixo antes do onend
      try { speechSynthesis.speak(u); } catch (e) { stopSpeech(); announce(t("audio.error")); }
    });
  }
  function speakSoon(ms) { clearTimeout(speech.timer); speech.timer = setTimeout(speakChunk, ms == null ? 80 : ms); }

  function loadSpeechQuote(delay) {
    const q = speech.queue[speech.qi];
    speech.qlang = quoteLang(q);
    speech.chunks = speech.engine === "cloud" ? cloudPieces(q, speech.qlang) : quoteChunks(q, speech.qlang); speech.ci = 0;
    const many = speech.queue.length > 1;
    announce(many ? t("audio.announceQueue", { i: speech.qi + 1, n: speech.queue.length, author: q.author }) : t("audio.announceStart", { author: q.author }));
    syncAudioUI();
    const el = $(".quote[data-id='" + q.id + "']");
    if (el && many) el.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
    speakSoon(delay);
  }
  function advanceQuote(auto) {
    if (speech.qi + 1 < speech.queue.length) {
      speech.qi++;
      if (!auto) { speech.gen++; haltOutput(false); }
      speech.paused = false;
      loadSpeechQuote(auto ? 0 : 120);
    } else {
      stopSpeech(); announce(t("audio.announceDone"));
    }
  }

  const focusInBar = () => { const a = document.activeElement; return !!(a && a.closest && a.closest(".audio-row")); };
  function startSpeech(quotes, source, single) {
    if (!speech.ok || !quotes.length) { if (speech.ok) announce(t("audio.nothing")); return; }
    const hadFocus = focusInBar();
    speech.gen++; clearTimeout(speech.timer);
    haltOutput(true);
    const cloud = cloudUsable(state.me, speech.blockedUntil, Date.now());
    if (cloud) unlockAudio();                   // ainda dentro do clique: libera o autoplay do <audio> reaproveitado
    Object.assign(speech, { queue: quotes.slice(), qi: 0, source, active: true, paused: false, single: !!single, noticeKey: "", engine: cloud ? "cloud" : "browser" });
    if (!cloud && !speech.browser) { Object.assign(speech, { active: false, queue: [], qi: -1, source: "" }); syncAudioUI(); announce(t("audio.unsupported")); return; }
    loadSpeechQuote(120);
    // O botão de iniciar some: o foco passa para "Pausar" para não cair no BODY.
    const bar = audioBars[source];
    if (hadFocus && bar && !bar.controls.hidden) bar.pause.focus();
  }
  function stopSpeech(msg) {
    if (!speech.ok) return;
    const was = speech.active;
    const hadFocus = was && focusInBar();
    const prev = { source: speech.source, single: speech.single, id: speech.queue[0] && speech.queue[0].id };
    speech.gen++; clearTimeout(speech.timer);
    haltOutput(true);
    Object.assign(speech, { active: false, paused: false, queue: [], qi: -1, chunks: [], ci: 0, source: "", utter: null, single: false, noticeKey: "", engine: "browser" });
    if (was) syncAudioUI();
    if (hadFocus) {
      // Os controles somem: devolve o foco ao "Ouvir" da citação ou ao "Ouvir a lista".
      const one = prev.single ? $(".btn-listen[data-id='" + prev.id + "']") : null;
      const bar = audioBars[prev.source];
      const target = one || (bar && bar.start);
      if (target && !target.hidden && target.getClientRects().length) target.focus();
    }
    if (msg) announce(msg);
  }
  function togglePause() {
    if (!speech.active) return;
    if (speech.paused) {
      speech.paused = false; announce(t("audio.announceResumed"));
      if (speech.engine === "cloud" && speech.hasSrc) {
        const g = speech.gen, p = speech.audio.play();
        if (p && p.catch) p.catch((e) => { if (g === speech.gen && !(e && e.name === "AbortError")) cloudFail(new TtsError(0, (e && e.name) || "play")); });
      } else speakSoon(60);
    }
    else {
      speech.paused = true; clearTimeout(speech.timer);
      if (speech.engine === "cloud" && speech.hasSrc) { try { speech.audio.pause(); } catch (e) { /* ignora */ } }   // mantém a posição
      else { speech.gen++; haltOutput(false); }
      announce(t("audio.announcePaused"));
    }
    syncAudioUI();
  }
  function setRate(r) {
    if (!RATES.includes(r)) return;
    speech.rate = r;
    try { localStorage.setItem(RATE_KEY, String(r)); } catch (e) { /* ignora */ }
    if (speech.active) {                      // reinicia a citação atual com a nova velocidade (nuvem e navegador)
      speech.gen++; haltOutput(true); clearTimeout(speech.timer);
      if (!speech.paused) speakSoon(120);
    }
    syncAudioUI();
  }

  function toggleListenOne(q, source) {
    if (speech.active && speech.queue.length === 1 && speech.queue[0].id === q.id) { stopSpeech(t("audio.announceStopped")); return; }
    startSpeech([q], source, true);
  }
  function listenList(name) { startSpeech(shownItems(name), name); }

  /* Barras de controle de cada lista. */
  const audioBars = {};
  function buildAudioBars() {
    $$("[data-audio-bar]").forEach((slot) => {
      const name = slot.dataset.audioBar;
      const id = "rate-" + name;
      const bar = {};
      bar.start = h("button", { class: "btn btn-secondary", type: "button", "aria-label": t("audio.listenListAria"), onclick: () => listenList(name) }, t("audio.listenList"));
      bar.pause = h("button", { class: "btn btn-secondary", type: "button", onclick: togglePause }, t("audio.pause"));
      bar.next = h("button", { class: "btn btn-secondary", type: "button", onclick: () => advanceQuote(false) }, t("audio.next"));
      bar.stop = h("button", { class: "btn btn-secondary", type: "button", onclick: () => stopSpeech(t("audio.announceStopped")) }, t("audio.stop"));
      bar.progress = h("span", { class: "small muted audio-progress" });
      bar.controls = h("div", { class: "audio-controls", hidden: true }, bar.pause, bar.next, bar.stop, bar.progress);
      bar.rate = h("select", { id, class: "rate-select" }, RATES.map((r) => h("option", { value: String(r) }, t("audio.rate", { rate: r.toLocaleString(t("meta.locale")) }))));
      bar.rate.addEventListener("change", () => setRate(parseFloat(bar.rate.value)));
      bar.rateWrap = h("div", { class: "rate-field" }, h("label", { for: id, text: t("audio.speed") }), bar.rate);
      bar.note = h("p", { class: "help-text audio-note", hidden: true });
      bar.credit = h("p", { class: "help-text audio-note audio-credit", hidden: true });
      slot.append(h("div", { class: "audio-row", role: "group", "aria-label": t("audio.group") }, bar.start, bar.controls, bar.rateWrap), bar.note, bar.credit);
      audioBars[name] = bar;
    });
  }

  function syncRandomListen() {
    const b = $("#randomListen");
    if (!b) return;
    b.hidden = !speech.ok || !rp.quote;
    const on = speech.active && speech.source === "random";
    b.setAttribute("aria-pressed", String(on && !speech.paused));
  }

  function syncAudioUI() {
    const cur = speech.active ? speech.queue[speech.qi] : null;
    $$(".btn-listen").forEach((b) => b.setAttribute("aria-pressed", String(!!cur && !speech.paused && String(cur.id) === b.dataset.id)));
    $$(".quote").forEach((a) => a.classList.toggle("is-speaking", !!cur && String(cur.id) === a.dataset.id));
    let voiceMissing = false;
    const cloudOn = cloudUsable(state.me, speech.blockedUntil, Date.now()) && !(speech.active && speech.engine === "browser");
    if (speech.browser && !cloudOn) {
      const vs = allVoices();
      voiceMissing = vs.length > 0 && !resolveSpeech(vs, speech.active ? speech.qlang : "", uiLang()).voice;
    }
    for (const [name, bar] of Object.entries(audioBars)) {
      const mine = speech.active && speech.source === name;
      const row = bar.start.parentNode;
      if (!speech.ok) { row.hidden = true; bar.note.hidden = false; bar.note.textContent = t("audio.unsupported"); continue; }
      row.hidden = false;
      bar.start.hidden = mine;
      bar.controls.hidden = !mine;
      bar.rate.value = String(speech.rate);
      bar.pause.textContent = speech.paused ? t("audio.resume") : t("audio.pause");
      bar.next.disabled = !(mine && speech.qi + 1 < speech.queue.length);
      bar.progress.textContent = mine ? t("audio.progress", { i: speech.qi + 1, n: speech.queue.length }) : "";
      const msg = mine && speech.noticeKey ? t(speech.noticeKey) : voiceMissing ? t("audio.noVoice") : "";
      bar.note.hidden = !msg;
      bar.note.textContent = msg;
      bar.credit.hidden = !cloudOn;
      bar.credit.textContent = cloudOn ? t("audio.cloudCredit") : "";
    }
    syncRandomListen();
  }
  if (speech.browser && speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", syncAudioUI);
  window.addEventListener("pagehide", () => haltOutput(true));
  /* Liga/desliga a voz em nuvem conforme /api/me (tts === true). */
  function setCloudFromMe(me) {
    speech.cloud = !!me && me.tts === true;
    speech.ok = speech.browser || speech.cloud;
    if (!speech.cloud) { speech.blockedUntil = 0; tts.abortAll(); tts.cache.clear(); }
    syncAudioUI();
  }

  $("#randomListen").addEventListener("click", () => {
    if (!rp.quote) return;
    if (speech.active && speech.source === "random") stopSpeech(t("audio.announceStopped"));
    else startSpeech([rp.quote], "random");
  });

  /* ---------- Importar citações ---------- */
  const imp = { items: [], uid: 0, busy: false, notes: [], resetArmed: false, dupTimer: 0, capped: false, lastRes: null };
  const PASTE_SRC = "\u0001paste";            // origem "texto colado" (traduzida na exibição)
  const srcName = (s) => (s === PASTE_SRC ? t("import.pasteName") : s);
  const MAX_PREVIEW = 500;
  const IMPORT_FIELDS = [["text", "import.fText"], ["author", "import.fAuthor"], ["work", "import.fWork"], ["page", "import.fPage"], ["tags", "import.fTags"], ["reflection", "import.fReflection"]];

  function enterImport() {
    if (!QI) { showImportNotes([{ error: true, msg: () => t("import.noLib") }]); }
    renderImportNotes();
    renderImportPreview(false);
  }
  function resetImport() {
    imp.items = []; imp.uid = 0; imp.notes = []; imp.capped = false; imp.resetArmed = false; imp.lastRes = null;
    $("#impReset").textContent = t("import.reset");
    const ta = $("#impPaste"); if (ta) ta.value = "";
    $("#impSummary").replaceChildren(); $("#impSummary").hidden = true;
    $("#impCount").textContent = "";
    renderImportNotes(); renderImportPreview(false);
  }

  function showImportNotes(list) { imp.notes = list; renderImportNotes(); }
  function renderImportNotes() {
    const box = $("#impNotes");
    box.replaceChildren(...imp.notes.map((n) => h("li", { class: "notice " + (n.error ? "notice-error" : "notice-info") }, icon(n.error ? "i-alert" : "i-check"), h("span", { text: msgText(n.msg) }))));
    box.hidden = !imp.notes.length;
  }

  function isTextFile(f) { return /\.(md|markdown|txt|text)$/i.test(f.name) || /^text\//.test(f.type); }
  function readFile(f) {
    if (f.text) return f.text();
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f, "UTF-8"); });
  }

  async function importFiles(fileList) {
    if (!QI || imp.busy) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const notes = [];
    $("#impReading").textContent = t("import.reading");
    for (const f of files) {
      if (f.size > QI.LIMITS.fileBytes) { notes.push({ error: true, msg: () => t("import.fileTooBig", { name: f.name }) }); continue; }
      if (!isTextFile(f)) { notes.push({ error: true, msg: () => t("import.fileType", { name: f.name }) }); continue; }
      let txt;
      try { txt = await readFile(f); } catch (e) { notes.push({ error: true, msg: () => t("import.fileRead", { name: f.name }) }); continue; }
      if (txt.includes("�")) notes.push({ error: false, msg: () => t("import.fileEncoding", { name: f.name }) });
      addParsed(txt, f.name, notes, () => t("import.fileNone", { name: f.name }));
    }
    $("#impReading").textContent = "";
    finishParse(notes);
  }

  function addParsed(text, source, notes, noneMsg) {
    const res = QI.parseText(text, { source });
    if (!res.items.length) notes.push({ error: true, msg: noneMsg });
    if (res.ignored) notes.push({ error: false, msg: () => t("import.ignored", { n: res.ignored, name: srcName(source) }) });
    for (const it of res.items) {
      if (imp.items.length >= MAX_PREVIEW) { imp.capped = true; break; }
      imp.items.push({
        uid: ++imp.uid, include: !it.needsReview, touched: false, text: it.text, author: it.author, work: it.work, page: it.page,
        reflection: it.reflection, tagsText: (it.tags || []).join(", "), source: it.source, format: it.format, dupOf: 0, serverError: false, serverItem: "", n: imp.uid,
      });
    }
  }

  function finishParse(notes) {
    if (imp.capped) notes.push({ error: false, msg: () => t("import.capped", { max: MAX_PREVIEW }) });
    imp.notes = notes;
    imp.lastRes = null;
    renderImportNotes();
    $("#impSummary").replaceChildren(); $("#impSummary").hidden = true;
    computeDuplicates();
    renderImportPreview(true);
  }

  $("#impPick").addEventListener("click", () => $("#impFile").click());
  $("#impFile").addEventListener("change", async (e) => { const fl = Array.from(e.target.files); e.target.value = ""; await importFiles(fl); });
  $("#impPasteBtn").addEventListener("click", () => {
    if (!QI) return;
    const txt = $("#impPaste").value;
    if (txt.length > QI.LIMITS.fileBytes) { showImportNotes([{ error: true, msg: () => t("import.pasteTooBig") }]); $("#impPaste").focus(); return; }
    if (!txt.trim()) { showImportNotes([{ error: true, msg: () => t("import.pasteEmpty") }]); $("#impPaste").focus(); return; }
    const notes = [];
    addParsed(txt, PASTE_SRC, notes, () => t("import.pasteNone"));
    finishParse(notes);
  });
  (function bindDrop() {
    const z = $("#impDrop");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter", "dragover"].forEach((ev) => z.addEventListener(ev, (e) => { stop(e); z.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => z.addEventListener(ev, (e) => { stop(e); z.classList.remove("is-over"); }));
    z.addEventListener("drop", (e) => { importFiles(e.dataTransfer ? e.dataTransfer.files : []); });
  })();

  function itemTags(it) { return QI.splitTagString(it.tagsText); }
  function itemErrors(it) {
    const e = QI.validateItem({ text: it.text, author: it.author, work: it.work, page: it.page, reflection: it.reflection, tags: itemTags(it) });
    const out = {};
    const L = QI.LIMITS;
    for (const [f, code] of Object.entries(e)) {
      if (f === "text") out.text = code === "required" ? t("val.textRequired") : t("val.tooLong", { max: L.text });
      else if (f === "author") out.author = code === "required" ? t("val.authorRequired") : t("val.tooLong", { max: L.author });
      else if (f === "work") out.work = t("val.tooLong", { max: L.work });
      else if (f === "reflection") out.reflection = t("val.tooLong", { max: L.reflection });
      else if (f === "page") out.page = t("val.pageInt");
      else if (f === "tags") out.tags = code === "tooMany" ? t("val.tagsMany", { max: L.tags }) : t("val.tagLong", { max: L.tag });
    }
    return out;
  }

  function computeDuplicates() {
    const dups = QI.findDuplicates(imp.items);
    imp.items.forEach((it, i) => { it.dupOf = dups.has(i) ? imp.items[dups.get(i)].n : 0; });
  }

  function renderImportPreview(focusIt) {
    const sec = $("#impPreview");
    sec.hidden = !imp.items.length;
    const list = $("#impList");
    list.replaceChildren(...imp.items.map(buildImportCard));
    if (imp.items.length) refreshImportSummary();
    if (focusIt && imp.items.length) {
      announce(tn("import.parsed", imp.items.length));
      const hh = $("#impPreviewH"); hh.setAttribute("tabindex", "-1"); hh.focus();
      hh.scrollIntoView({ block: "start", behavior: reduceMotion.matches ? "auto" : "smooth" });
    }
  }

  function buildImportCard(it) {
    const p = "imp-" + it.uid;
    const card = h("li", { class: "import-item", "data-uid": it.uid });
    const check = h("input", { type: "checkbox", id: p + "-inc" });
    check.checked = it.include;
    check.addEventListener("change", () => { it.include = check.checked; it.touched = true; refreshImportItem(it, card); refreshImportSummary(); });
    const badges = h("div", { class: "import-badges" });
    card.append(h("div", { class: "import-head" },
      h("h3", { text: t("import.cardTitle", { n: it.n }) }),
      h("label", { class: "check-row", for: p + "-inc" }, check, h("span", { text: t("import.include") }))), badges);

    const grid = h("div", { class: "import-grid" });
    const inputs = {};
    for (const [f, key] of IMPORT_FIELDS) {
      const multiline = f === "text" || f === "reflection";
      const id = p + "-" + f;
      const val = f === "tags" ? it.tagsText : it[f];
      const el = multiline
        ? h("textarea", { id, rows: f === "text" ? 4 : 2, class: "serif-input", "aria-describedby": id + "-err" })
        : h("input", { id, type: "text", autocomplete: "off", "aria-describedby": id + "-err", inputmode: f === "page" ? "numeric" : null });
      el.value = val;
      el.addEventListener("input", () => {
        if (f === "tags") it.tagsText = el.value; else it[f] = el.value;
        it.serverError = false; it.serverItem = "";
        if (it.serverFields) delete it.serverFields[f];
        if (!it.touched && !it.include && Object.keys(itemErrors(it)).length === 0) { it.include = true; check.checked = true; }
        refreshImportItem(it, card);
        refreshImportSummary();
        if (f === "text" || f === "author") { clearTimeout(imp.dupTimer); imp.dupTimer = setTimeout(() => { computeDuplicates(); imp.items.forEach((x) => { const c = $("[data-uid='" + x.uid + "']", $("#impList")); if (c) refreshImportItem(x, c); }); refreshImportSummary(); }, 250); }
      });
      inputs[f] = el;
      grid.append(h("div", { class: "field import-f-" + f }, h("label", { for: id, text: t(key) }), el, h("p", { class: "field-error", id: id + "-err", hidden: true })));
    }
    card.append(grid);
    card._inputs = inputs; card._badges = badges;
    refreshImportItem(it, card);
    return card;
  }

  function refreshImportItem(it, card) {
    const srvErrs = {};
    for (const [k, v] of Object.entries(it.serverFields || {})) srvErrs[k] = srv(v);
    const errs = Object.assign({}, srvErrs, itemErrors(it));
    const inputs = card._inputs;
    for (const [f] of IMPORT_FIELDS) {
      const err = $("#imp-" + it.uid + "-" + f + "-err", card);
      if (errs[f]) { err.textContent = errs[f]; err.hidden = false; inputs[f].setAttribute("aria-invalid", "true"); }
      else { err.hidden = true; err.textContent = ""; inputs[f].removeAttribute("aria-invalid"); }
    }
    const invalid = Object.keys(errs).length > 0;
    card.classList.toggle("is-invalid", invalid);
    card.classList.toggle("is-off", !it.include);
    const b = card._badges;
    b.replaceChildren();
    if (invalid) b.append(h("span", { class: "badge badge-warn" }, icon("i-alert"), t("import.badgeReview")));
    if (it.dupOf) b.append(h("span", { class: "badge" }, t("import.badgeDup", { n: it.dupOf })));
    if (it.serverError && !Object.keys(it.serverFields || {}).length) b.append(h("span", { class: "badge badge-warn" }, icon("i-alert"), t("import.badgeServer", { reason: serverReason(it) })));
    b.append(h("span", { class: "badge" }, icon("i-lock"), t("import.privateBadge")));
    if (it.source) b.append(h("span", { class: "badge badge-quiet" }, t("import.badgeSource", { name: srcName(it.source) })));
    b.hidden = false;
  }

  /* Motivo da recusa do servidor, traduzido na hora de exibir. */
  function serverReason(it) {
    const f = Object.values(it.serverFields || {}).map((v) => srv(v)).join(" ");
    return f || (it.serverItem ? srv(it.serverItem) : "") || t("import.reasonInvalid");
  }

  function refreshImportSummary() {
    const total = imp.items.length;
    const sel = imp.items.filter((i) => i.include).length;
    $("#impCount").textContent = t("import.selected", { n: sel, m: total });
    const review = imp.items.filter((i) => Object.keys(itemErrors(i)).length).length;
    const dup = imp.items.filter((i) => i.dupOf).length;
    const warn = $("#impWarn");
    warn.replaceChildren();
    if (review) warn.append(h("li", { class: "notice notice-error" }, icon("i-alert"), h("span", { text: tn("import.warnReview", review) })));
    if (dup) warn.append(h("li", { class: "notice notice-info" }, icon("i-alert"), h("span", { text: tn("import.warnDup", dup) })));
    warn.hidden = !warn.childNodes.length;
    $("#impUnrepeat").hidden = !dup;
    const btn = $("#impSubmit");
    btn.textContent = sel ? t("import.submit", { n: sel }) : t("import.submitNone");
    btn.disabled = imp.busy || !sel;
  }

  $("#impAll").addEventListener("click", () => setAllIncluded(true));
  $("#impNone").addEventListener("click", () => setAllIncluded(false));
  $("#impUnrepeat").addEventListener("click", () => {
    imp.items.forEach((it) => { if (it.dupOf) it.include = false; it.touched = true; });
    syncChecks();
  });
  function setAllIncluded(v) { imp.items.forEach((it) => { it.include = v; it.touched = true; }); syncChecks(); }
  function syncChecks() {
    imp.items.forEach((it) => {
      const card = $("#impList [data-uid='" + it.uid + "']");
      if (!card) return;
      $("#imp-" + it.uid + "-inc").checked = it.include;
      refreshImportItem(it, card);
    });
    refreshImportSummary();
  }

  let resetTimer = 0;
  $("#impReset").addEventListener("click", () => {
    if (!imp.items.length && !imp.notes.length) { resetImport(); return; }
    if (!imp.resetArmed) {
      imp.resetArmed = true; $("#impReset").textContent = t("import.resetConfirm");
      resetTimer = setTimeout(() => { imp.resetArmed = false; $("#impReset").textContent = t("import.reset"); }, 4000);
      return;
    }
    clearTimeout(resetTimer); imp.resetArmed = false; $("#impReset").textContent = t("import.reset");
    resetImport();
    $("#impPick").focus();
  });

  const BATCH_BYTES = 800 * 1024;
  const payloadOf = (it) => QI.toPayload({ text: it.text, author: it.author, work: it.work, page: it.page, reflection: it.reflection, tags: itemTags(it) });
  // Fatia por contagem (200) e por bytes (~800 KB de JSON) para não estourar o limite do servidor.
  function batchItems(list) {
    const enc = new TextEncoder();
    const out = [];
    let cur = [], bytes = 2;
    for (const it of list) {
      const size = enc.encode(JSON.stringify(payloadOf(it))).length + 1;
      if (cur.length && (cur.length >= QI.LIMITS.items || bytes + size > BATCH_BYTES)) { out.push(cur); cur = []; bytes = 2; }
      cur.push(it); bytes += size;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function importError(err, single) {
    if (err.status === 404 || err.status === 405) return t("import.errUnavailable");
    if (err.status === 413) return t(single ? "import.errBigOne" : "import.errBig");
    if (err.status === 0) return err.message;
    if (err.status >= 500) return t("import.errGeneric");
    return err.message || t("import.errGeneric");
  }

  $("#impSubmit").addEventListener("click", async () => {
    if (imp.busy || !QI) return;
    const sel = imp.items.filter((i) => i.include);
    if (!sel.length) { announce(t("import.noSelection")); return; }
    const bad = sel.filter((i) => Object.keys(itemErrors(i)).length);
    const msgBox = $("#impSubmitMsg");
    msgBox.replaceChildren(); msgBox.hidden = true;
    if (bad.length) {
      msgBox.append(h("p", { class: "notice notice-error", role: "alert" }, icon("i-alert"), h("span", { text: tn("import.fixFirst", bad.length) })));
      msgBox.hidden = false;
      const first = $("#impList [data-uid='" + bad[0].uid + "'] [aria-invalid='true']");
      if (first) first.focus();
      return;
    }
    imp.busy = true;
    $("#impSubmit").disabled = true;
    const batches = batchItems(sel);
    const res = { created: 0, dup: 0, invalid: [], unsent: 0, error: "" };
    const done = new Set();
    for (let b = 0; b < batches.length; b++) {
      $("#impSubmit").textContent = batches.length > 1 ? t("import.sending", { i: b + 1, n: batches.length }) : t("import.submitting");
      const batch = batches[b];
      let data;
      try {
        data = await api("/api/quotes/import", { method: "POST", body: { items: batch.map(payloadOf) } });
      } catch (err) {
        if (handle401(err)) { imp.busy = false; refreshImportSummary(); return; }
        res.error = () => importError(err, batch.length === 1);
        res.unsent = batches.slice(b).reduce((n, x) => n + x.length, 0);
        break;
      }
      res.created += Number(data.created) || 0;
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      const skippedIdx = new Set();
      for (const s of skipped) {
        const it = batch[s.index];
        if (!it) continue;
        skippedIdx.add(s.index);
        const reason = String(s.reason || "");
        if (/dup/i.test(reason)) { res.dup++; done.add(it.uid); continue; }
        const fieldMsgs = {};
        if (s.fields && typeof s.fields === "object") {
          for (const f of ["text", "author", "work", "page", "reflection", "tags"]) if (typeof s.fields[f] === "string" && s.fields[f]) fieldMsgs[f] = s.fields[f];
        }
        it.serverFields = fieldMsgs;
        it.serverItem = s.fields && typeof s.fields.item === "string" ? s.fields.item : "";
        it.serverError = true;
        res.invalid.push({ it });
      }
      batch.forEach((it, i) => { if (!skippedIdx.has(i)) done.add(it.uid); });
    }
    imp.busy = false;
    imp.items = imp.items.filter((i) => !done.has(i.uid));
    refreshImportSummary();               // repõe rótulo e estado do botão de enviar
    if (res.created) { resetListsKeepCache(); }
    computeDuplicates();
    renderImportPreview(false);
    if (!imp.items.length) $("#impPreview").hidden = true;
    renderImportSummary(res);
  });

  function renderImportSummary(res, quiet) {
    imp.lastRes = res;
    const box = $("#impSummary");
    box.replaceChildren(h("h2", { id: "impSummaryH", text: t("import.summaryTitle"), tabindex: "-1" }));
    if (res.error) box.append(h("p", { class: "notice notice-error", role: "alert" }, icon("i-alert"), h("span", { text: msgText(res.error) })));
    box.append(h("ul", { class: "import-stats" },
      h("li", { class: "stat-ok" }, icon("i-check"), t("import.sumCreated", { n: res.created })),
      h("li", {}, t("import.sumDup", { n: res.dup })),
      h("li", {}, t("import.sumInvalid", { n: res.invalid.length })),
      res.unsent ? h("li", {}, t("import.sumFailed", { n: res.unsent })) : null));
    if (res.invalid.length) {
      box.append(h("p", { class: "help-text", text: t("import.invalidListTitle") }),
        h("ul", { class: "import-invalid" }, res.invalid.map((x) => h("li", {}, h("q", { text: x.it.text.length > 90 ? x.it.text.slice(0, 90) + "…" : x.it.text }), " ", h("span", { class: "muted", text: serverReason(x.it) })))));
    }
    box.append(h("a", { class: "btn btn-primary", href: "#/minhas", text: t("import.toMine") }));
    box.hidden = false;
    if (quiet) return;
    const hh = $("#impSummaryH"); hh.focus();
    hh.scrollIntoView({ block: "start", behavior: reduceMotion.matches ? "auto" : "smooth" });
  }

  /* ---------- Inicialização e autenticação ---------- */
  /* ---------- Convite para o servidor do Discord (opcional, por clique) ---------- */
  const INVITE_RE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,32}$/;  // espelha functions/_lib/invite.js
  const validInvite = (u) => typeof u === "string" && INVITE_RE.test(u);
  let invitePromptShown = false;

  function syncInviteLink(me) {
    const a = $("#discordInviteLink");
    const url = me && me.invitePrompt && me.invitePrompt.url;
    if (validInvite(url) && state.auth === "in") { a.href = url; a.hidden = false; }
    else { a.removeAttribute("href"); a.hidden = true; }
  }

  function maybeShowInvitePrompt(me) {
    const ip = me && me.invitePrompt;
    if (invitePromptShown || state.auth !== "in" || !ip || ip.show !== true || !validInvite(ip.url)) return;
    invitePromptShown = true;
    const dlg = $("#invitePrompt");
    if (!dlg || typeof dlg.showModal !== "function") return;
    let answered = false;
    const answer = (action) => {
      if (answered) return;
      answered = true;
      if (dlg.open) dlg.close();
      if (action === "accepted" && validInvite(ip.url)) window.open(ip.url, "_blank", "noopener,noreferrer");
      api("/api/discord/invite-prompt", { method: "POST", body: { action } })
        .catch((e) => { if (e.status === 0) toast(e.message, true); });
    };
    $("#inviteYes").onclick = () => answer("accepted");
    $("#inviteNo").onclick = () => answer("dismissed");
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); answer("dismissed"); }, { once: true });
    dlg.showModal();
    $("#inviteYes").focus();
  }

  async function init() {
    setupSearch();
    setScope("author");
    buildAudioBars();
    applyStatic();
    syncAudioUI();

    const params = new URLSearchParams(location.search);
    const authError = params.get("auth_error");
    const loginOk = params.get("login") === "success";
    if (authError !== null || params.has("login")) {
      history.replaceState(null, "", location.pathname + location.hash);
    }

    try {
      const data = await api("/api/me");
      state.user = data.user; state.auth = "in"; state.me = data;
      setCloudFromMe(data);
    } catch (err) {
      state.user = null;
      state.auth = err.status === 401 ? "out" : "error";
      if (state.auth === "error") {
        const box = $("#entradaNetErr");
        setDyn(box, () => t("entrada.netErr"));
        box.hidden = false;
      }
    }

    if (authError !== null) {
      history.replaceState(null, "", "#/entrar");
      state.auth = state.auth === "in" ? "in" : state.auth;
      if (state.auth !== "in") {
        showLogin({ first: true, detail: authError ? () => t("login.codeDetail", { code: authError }) : "" });
        updateChrome();
        return;
      }
    }
    if (loginOk && state.auth === "in") {
      const next = takeNext();
      const bare = !location.hash || location.hash === "#/" || location.hash === "#/entrar";
      if (next && bare) history.replaceState(null, "", next);
      else if (!location.hash || location.hash === "#/") history.replaceState(null, "", "#/feed");
      toast(t("toast.welcome", { name: state.user.username || "" }));
    } else if (loginOk && state.auth !== "in") {
      showLogin({ first: true, message: () => t("login.error") });
      return;
    }
    route({ first: true });
    syncInviteLink(state.me);
    maybeShowInvitePrompt(state.me);
  }

  init();
})();
