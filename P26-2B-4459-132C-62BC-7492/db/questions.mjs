// Banco de questões (fonte única). `npm run seed:gen` gera db/seed.sql a partir deste arquivo.
// Formato: c = categoria, t = enunciado, ok = alternativa correta, bad = 3 alternativas incorretas.
// A posição da correta é definida pelo gerador e as alternativas são embaralhadas de novo a cada quiz.

export const categories = [
  { id: 'web', name: 'Programação Web', description: 'HTML, CSS, JavaScript e HTTP.' },
  { id: 'mat', name: 'Matemática', description: 'Aritmética, álgebra, geometria e cálculo básico.' },
  { id: 'hist', name: 'História do Brasil', description: 'Da chegada da corte ao Plano Real.' },
  { id: 'cien', name: 'Ciências da Natureza', description: 'Física, química, biologia e astronomia.' },
];

export const questions = [
  // ---------- Programação Web ----------
  { c: 'web', t: 'Qual elemento HTML5 representa o conteúdo principal e único de uma página?', ok: '<main>', bad: ['<section>', '<aside>', '<div>'] },
  { c: 'web', t: 'Qual propriedade CSS define o espaço entre o conteúdo e a borda de um elemento?', ok: 'padding', bad: ['margin', 'border-spacing', 'gap'] },
  { c: 'web', t: 'Em JavaScript, qual é o resultado de typeof null?', ok: '"object"', bad: ['"null"', '"undefined"', '"number"'] },
  { c: 'web', t: 'Qual método de array devolve um novo array apenas com os elementos que passam em um teste?', ok: 'filter()', bad: ['map()', 'reduce()', 'forEach()'] },
  { c: 'web', t: 'O que significa o código de status HTTP 404?', ok: 'Recurso não encontrado', bad: ['Erro interno do servidor', 'Acesso não autorizado', 'Requisição malformada'] },
  { c: 'web', t: 'Qual declaração cria uma variável de escopo de bloco que não pode ser reatribuída?', ok: 'const', bad: ['var', 'let', 'static'] },
  { c: 'web', t: 'Com box-sizing: content-box (padrão), a propriedade width define a largura de qual parte da caixa?', ok: 'Apenas a área de conteúdo', bad: ['Conteúdo + padding', 'Conteúdo + padding + borda', 'Conteúdo + padding + borda + margem'] },
  { c: 'web', t: 'Qual método HTTP é usado, por convenção, para enviar dados que criam um novo recurso?', ok: 'POST', bad: ['GET', 'HEAD', 'OPTIONS'] },
  { c: 'web', t: 'O que faz a palavra-chave await dentro de uma função async?', ok: 'Pausa a função até a Promise ser resolvida', bad: ['Bloqueia toda a thread principal', 'Cria uma nova thread de execução', 'Cancela a Promise imediatamente'] },
  { c: 'web', t: 'Qual API do navegador faz requisições HTTP retornando Promises?', ok: 'fetch()', bad: ['XMLHttpRequest', 'localStorage', 'history.pushState()'] },
  { c: 'web', t: 'Qual atributo HTML5 torna obrigatório o preenchimento de um campo de formulário?', ok: 'required', bad: ['mandatory', 'validate', 'needed'] },
  { c: 'web', t: 'Qual valor da propriedade display ativa o layout flexível (Flexbox)?', ok: 'flex', bad: ['block', 'inline', 'table'] },

  // ---------- Matemática ----------
  { c: 'mat', t: 'Quanto vale 2 elevado a 10?', ok: '1024', bad: ['512', '2048', '1000'] },
  { c: 'mat', t: 'Qual é a raiz quadrada de 144?', ok: '12', bad: ['14', '16', '11'] },
  { c: 'mat', t: 'Quanto soma os ângulos internos de um triângulo no plano?', ok: '180°', bad: ['90°', '270°', '360°'] },
  { c: 'mat', t: 'Qual é a derivada de f(x) = x² em relação a x?', ok: '2x', bad: ['x', 'x²', '2'] },
  { c: 'mat', t: 'Quanto é 15% de 200?', ok: '30', bad: ['15', '20', '45'] },
  { c: 'mat', t: 'Qual é o valor de 5! (fatorial de 5)?', ok: '120', bad: ['24', '60', '720'] },
  { c: 'mat', t: 'Quantos números primos existem entre 1 e 10?', ok: '4', bad: ['3', '5', '6'] },
  { c: 'mat', t: 'Quais são as soluções reais de x² − 9 = 0?', ok: 'x = 3 ou x = −3', bad: ['Apenas x = 3', 'x = 9', 'x = 9 ou x = −9'] },
  { c: 'mat', t: 'Qual é a fórmula da área de um círculo de raio r?', ok: 'πr²', bad: ['2πr', 'πr', '4πr²'] },
  { c: 'mat', t: 'Qual é o mínimo múltiplo comum (MMC) de 4 e 6?', ok: '12', bad: ['24', '2', '10'] },
  { c: 'mat', t: 'Quanto vale log₁₀(1000)?', ok: '3', bad: ['2', '10', '100'] },
  { c: 'mat', t: 'Qual é a média aritmética de 4, 8 e 12?', ok: '8', bad: ['6', '10', '12'] },

  // ---------- História do Brasil ----------
  { c: 'hist', t: 'Em que ano foi proclamada a Independência do Brasil?', ok: '1822', bad: ['1808', '1889', '1500'] },
  { c: 'hist', t: 'Quem proclamou a República no Brasil em 15 de novembro de 1889?', ok: 'Marechal Deodoro da Fonseca', bad: ['Floriano Peixoto', 'Dom Pedro II', 'Getúlio Vargas'] },
  { c: 'hist', t: 'Em que ano foi assinada a Lei Áurea, que aboliu a escravidão no Brasil?', ok: '1888', bad: ['1871', '1850', '1889'] },
  { c: 'hist', t: 'Em que ano a família real portuguesa chegou ao Brasil, fugindo de Napoleão?', ok: '1808', bad: ['1789', '1815', '1822'] },
  { c: 'hist', t: 'Quem foi o primeiro presidente civil da República brasileira?', ok: 'Prudente de Morais', bad: ['Campos Sales', 'Rodrigues Alves', 'Deodoro da Fonseca'] },
  { c: 'hist', t: 'Qual líder da Inconfidência Mineira foi executado em 1792?', ok: 'Tiradentes', bad: ['Zumbi dos Palmares', 'Frei Caneca', 'Dom Pedro I'] },
  { c: 'hist', t: 'Qual período é conhecido como Era Vargas?', ok: '1930–1945', bad: ['1889–1930', '1945–1964', '1964–1985'] },
  { c: 'hist', t: 'Em que ano começou o regime militar no Brasil?', ok: '1964', bad: ['1930', '1954', '1985'] },
  { c: 'hist', t: 'Em que ano foi promulgada a Constituição Federal atualmente em vigor?', ok: '1988', bad: ['1967', '1946', '1824'] },
  { c: 'hist', t: 'Qual cidade era a capital federal imediatamente antes de Brasília?', ok: 'Rio de Janeiro', bad: ['Salvador', 'São Paulo', 'Recife'] },
  { c: 'hist', t: 'Qual é o líder mais conhecido do Quilombo dos Palmares?', ok: 'Zumbi', bad: ['Tiradentes', 'Antônio Conselheiro', 'Lampião'] },
  { c: 'hist', t: 'Qual plano econômico estabilizou a moeda brasileira em 1994?', ok: 'Plano Real', bad: ['Plano Cruzado', 'Plano Collor', 'Plano Bresser'] },

  // ---------- Ciências da Natureza ----------
  { c: 'cien', t: 'Qual é o símbolo químico do ouro?', ok: 'Au', bad: ['Ag', 'Go', 'Or'] },
  { c: 'cien', t: 'Qual é o planeta do Sistema Solar mais próximo do Sol?', ok: 'Mercúrio', bad: ['Vênus', 'Marte', 'Terra'] },
  { c: 'cien', t: 'Qual é o gás mais abundante na atmosfera terrestre?', ok: 'Nitrogênio', bad: ['Oxigênio', 'Gás carbônico', 'Argônio'] },
  { c: 'cien', t: 'Qual organela celular é a principal responsável pela respiração celular?', ok: 'Mitocôndria', bad: ['Ribossomo', 'Lisossomo', 'Complexo de Golgi'] },
  { c: 'cien', t: 'Qual é, aproximadamente, a velocidade da luz no vácuo?', ok: '300.000 km/s', bad: ['30.000 km/s', '150.000 km/s', '3.000 km/s'] },
  { c: 'cien', t: 'Qual é a unidade de força no Sistema Internacional de Unidades?', ok: 'Newton', bad: ['Joule', 'Watt', 'Pascal'] },
  { c: 'cien', t: 'Quem propôs a teoria da evolução por seleção natural?', ok: 'Charles Darwin', bad: ['Gregor Mendel', 'Louis Pasteur', 'Isaac Newton'] },
  { c: 'cien', t: 'Qual é o pH de uma solução neutra a 25 °C?', ok: '7', bad: ['0', '1', '14'] },
  { c: 'cien', t: 'Como se chama o processo pelo qual as plantas produzem glicose usando luz solar?', ok: 'Fotossíntese', bad: ['Respiração celular', 'Fermentação', 'Digestão'] },
  { c: 'cien', t: 'Como também é conhecida a Primeira Lei de Newton?', ok: 'Lei da inércia', bad: ['Lei da ação e reação', 'Lei da gravitação universal', 'Princípio fundamental da dinâmica'] },
  { c: 'cien', t: 'Qual é o número atômico do carbono?', ok: '6', bad: ['12', '8', '14'] },
  { c: 'cien', t: 'Qual é o maior osso do corpo humano?', ok: 'Fêmur', bad: ['Tíbia', 'Úmero', 'Rádio'] },
];
