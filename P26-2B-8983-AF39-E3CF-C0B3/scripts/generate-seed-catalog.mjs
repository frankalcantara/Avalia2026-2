import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editorialUserId = "panela-editorial";

const recipes = [
  {
    slug: "pao-de-queijo", title: "Pão de queijo mineiro", category: "bread", prepTime: 40, servings: 6,
    description: "Casquinha dourada, miolo macio e queijo em cada mordida.",
    ingredients: [["polvilho azedo", 250, "g"], ["leite", 120, "ml"], ["óleo", 60, "ml"], ["queijo meia-cura ralado", 180, "g"], ["ovo", 1, "unidade"]],
    steps: ["Aqueça o leite com o óleo até começar a ferver e despeje sobre o polvilho.", "Espere amornar, misture o queijo e o ovo até formar uma massa uniforme.", "Modele bolinhas e asse a 200 °C por 25 minutos."],
  },
  {
    slug: "tapioca-queijo-tomate", title: "Tapioca de queijo e tomate", category: "bread", prepTime: 15, servings: 2,
    description: "Lanche rápido com queijo derretido, tomate e manjericão.",
    ingredients: [["goma de tapioca", 160, "g"], ["muçarela", 100, "g"], ["tomate", 1, "unidade"], ["manjericão", 6, "folhas"]],
    steps: ["Aqueça uma frigideira antiaderente e espalhe metade da goma em uma camada uniforme.", "Quando unir, vire a tapioca, recheie com queijo e tomate e dobre ao meio.", "Tampe por 2 minutos para derreter e finalize com manjericão."],
  },
  {
    slug: "cuscuz-nordestino", title: "Cuscuz nordestino", category: "bread", prepTime: 25, servings: 4,
    description: "Cuscuz de milho fofinho para acompanhar café ou almoço.",
    ingredients: [["flocão de milho", 250, "g"], ["água", 180, "ml"], ["sal", 3, "g"], ["manteiga", 20, "g"]],
    steps: ["Misture o flocão, o sal e a água e deixe hidratar por 10 minutos.", "Coloque a massa sem apertar na cuscuzeira com água fervente.", "Cozinhe no vapor por 10 minutos e sirva com manteiga."],
  },
  {
    slug: "omelete-caprese", title: "Omelete caprese", category: "salad", prepTime: 15, servings: 1,
    description: "Ovos macios com tomate, muçarela e folhas de manjericão.",
    ingredients: [["ovos", 2, "unidades"], ["tomate-cereja", 80, "g"], ["muçarela", 50, "g"], ["manjericão", 5, "folhas"]],
    steps: ["Bata os ovos com uma pitada de sal e despeje em uma frigideira untada.", "Quando as bordas firmarem, distribua tomate e muçarela sobre metade.", "Dobre a omelete, cozinhe até o queijo derreter e acrescente o manjericão."],
  },
  {
    slug: "panqueca-banana", title: "Panqueca de banana e aveia", category: "cake", prepTime: 20, servings: 2,
    description: "Panquecas leves com banana madura e canela.",
    ingredients: [["banana madura", 2, "unidades"], ["ovo", 1, "unidade"], ["aveia em flocos", 60, "g"], ["canela", 2, "g"]],
    steps: ["Amasse as bananas e misture com o ovo, a aveia e a canela.", "Despeje pequenas porções em frigideira antiaderente aquecida.", "Doure dos dois lados e sirva ainda morna."],
  },
  {
    slug: "overnight-oats-morango", title: "Aveia dormida com morango", category: "dessert", prepTime: 10, servings: 2,
    description: "Café da manhã preparado na véspera, cremoso e refrescante.",
    ingredients: [["aveia em flocos", 100, "g"], ["leite", 180, "ml"], ["iogurte natural", 120, "g"], ["morango", 120, "g"], ["mel", 15, "ml"]],
    steps: ["Misture a aveia, o leite, o iogurte e o mel em dois potes.", "Tampe e deixe na geladeira por pelo menos 6 horas.", "Antes de servir, cubra com morangos fatiados."],
  },
  {
    slug: "crepioca-espinafre", title: "Crepioca de espinafre", category: "bread", prepTime: 15, servings: 1,
    description: "Massa macia de tapioca com espinafre e queijo branco.",
    ingredients: [["ovo", 1, "unidade"], ["goma de tapioca", 35, "g"], ["espinafre", 30, "g"], ["queijo branco", 40, "g"]],
    steps: ["Bata o ovo com a goma e misture o espinafre picado.", "Despeje em frigideira antiaderente e cozinhe até firmar.", "Recheie com queijo branco, dobre e aqueça por mais 1 minuto."],
  },
  {
    slug: "pao-chapa-requeijao", title: "Pão na chapa com requeijão", category: "bread", prepTime: 10, servings: 2,
    description: "Clássico de padaria com a superfície tostada na manteiga.",
    ingredients: [["pão francês", 2, "unidades"], ["manteiga", 20, "g"], ["requeijão", 40, "g"]],
    steps: ["Corte os pães ao meio e espalhe a manteiga no miolo.", "Toste em uma frigideira quente até dourar.", "Passe requeijão e sirva imediatamente."],
  },
  {
    slug: "vitamina-banana", title: "Vitamina de banana e cacau", category: "drink", prepTime: 5, servings: 2,
    description: "Bebida cremosa de banana com um toque de cacau.",
    ingredients: [["banana", 2, "unidades"], ["leite gelado", 350, "ml"], ["cacau em pó", 10, "g"], ["mel", 10, "ml"]],
    steps: ["Descasque as bananas e corte em pedaços.", "Bata todos os ingredientes no liquidificador por 1 minuto.", "Sirva gelada, sem coar."],
  },
  {
    slug: "granola-caseira", title: "Granola caseira crocante", category: "bake", prepTime: 35, servings: 8,
    description: "Mistura tostada de aveia, castanhas e mel para a semana.",
    ingredients: [["aveia em flocos", 250, "g"], ["castanha-do-pará", 80, "g"], ["mel", 60, "ml"], ["óleo de coco", 25, "ml"], ["uva-passa", 50, "g"]],
    steps: ["Misture aveia, castanhas picadas, mel e óleo de coco.", "Espalhe em assadeira e asse a 170 °C por 25 minutos, mexendo na metade.", "Espere esfriar e incorpore as uvas-passas."],
  },
  {
    slug: "salada-tropical", title: "Salada tropical de manga", category: "salad", prepTime: 15, servings: 4,
    description: "Folhas frescas com manga, pepino e molho cítrico.",
    ingredients: [["alface", 120, "g"], ["manga", 1, "unidade"], ["pepino", 1, "unidade"], ["limão", 1, "unidade"], ["azeite", 20, "ml"]],
    steps: ["Lave e seque as folhas e corte a manga e o pepino em cubos.", "Misture o suco de limão com azeite, sal e pimenta.", "Monte a salada e regue com o molho na hora de servir."],
  },
  {
    slug: "salada-grao-bico", title: "Salada de grão-de-bico", category: "salad", prepTime: 20, servings: 4,
    description: "Salada nutritiva com ervas, tomate e limão.",
    ingredients: [["grão-de-bico cozido", 300, "g"], ["tomate", 2, "unidades"], ["cebola-roxa", 0.5, "unidade"], ["salsinha", 15, "g"], ["limão", 1, "unidade"]],
    steps: ["Escorra o grão-de-bico e coloque em uma tigela.", "Junte tomate, cebola e salsinha picados.", "Tempere com limão, azeite, sal e pimenta e misture."],
  },
  {
    slug: "salada-quinoa", title: "Salada de quinoa e legumes", category: "salad", prepTime: 30, servings: 4,
    description: "Quinoa soltinha com legumes coloridos e hortelã.",
    ingredients: [["quinoa", 180, "g"], ["abobrinha", 1, "unidade"], ["cenoura", 1, "unidade"], ["hortelã", 10, "folhas"], ["limão", 1, "unidade"]],
    steps: ["Cozinhe a quinoa em água com sal por 15 minutos e escorra.", "Grelhe a abobrinha em cubos e rale a cenoura.", "Misture tudo com hortelã, limão e azeite e sirva fria."],
  },
  {
    slug: "sopa-abobora", title: "Sopa cremosa de abóbora", category: "soup", prepTime: 40, servings: 4,
    description: "Abóbora macia batida com gengibre e finalizada com ervas.",
    ingredients: [["abóbora cabotiá", 600, "g"], ["cebola", 1, "unidade"], ["gengibre", 10, "g"], ["caldo de legumes", 700, "ml"], ["creme de leite", 100, "ml"]],
    steps: ["Refogue a cebola e o gengibre e acrescente a abóbora em cubos.", "Adicione o caldo e cozinhe até a abóbora ficar macia.", "Bata até ficar cremosa, misture o creme de leite e aqueça sem ferver."],
  },
  {
    slug: "caldo-verde", title: "Caldo verde", category: "soup", prepTime: 45, servings: 5,
    description: "Caldo de batata com couve fininha e linguiça dourada.",
    ingredients: [["batata", 500, "g"], ["couve", 120, "g"], ["linguiça calabresa", 180, "g"], ["cebola", 1, "unidade"], ["água", 1, "litro"]],
    steps: ["Cozinhe as batatas com a cebola na água até ficarem macias.", "Bata as batatas com parte do caldo e volte à panela.", "Doure a linguiça, junte ao caldo e finalize com a couve fatiada."],
  },
  {
    slug: "creme-mandioquinha", title: "Creme de mandioquinha", category: "soup", prepTime: 35, servings: 4,
    description: "Creme aveludado de mandioquinha com alho-poró.",
    ingredients: [["mandioquinha", 500, "g"], ["alho-poró", 1, "unidade"], ["caldo de legumes", 700, "ml"], ["creme de leite", 80, "ml"]],
    steps: ["Refogue o alho-poró fatiado em um fio de azeite.", "Junte a mandioquinha e o caldo e cozinhe até amaciar.", "Bata, acrescente o creme de leite e ajuste o sal."],
  },
  {
    slug: "macarrao-alho-oleo", title: "Macarrão alho e óleo", category: "pasta", prepTime: 20, servings: 4,
    description: "Massa simples envolvida em azeite, alho dourado e salsinha.",
    ingredients: [["espaguete", 350, "g"], ["alho", 5, "dentes"], ["azeite", 60, "ml"], ["salsinha", 15, "g"], ["pimenta-calabresa", 2, "g"]],
    steps: ["Cozinhe o espaguete em água salgada até ficar al dente.", "Doure o alho fatiado no azeite em fogo baixo e acrescente a pimenta.", "Misture a massa escorrida e finalize com salsinha."],
  },
  {
    slug: "risoto-cogumelos", title: "Risoto de cogumelos", category: "rice", prepTime: 40, servings: 4,
    description: "Arroz cremoso com cogumelos salteados e parmesão.",
    ingredients: [["arroz arbóreo", 300, "g"], ["cogumelo-de-paris", 200, "g"], ["caldo de legumes", 1.2, "litro"], ["vinho branco", 100, "ml"], ["parmesão", 60, "g"]],
    steps: ["Doure os cogumelos fatiados e reserve.", "Refogue o arroz, junte o vinho e acrescente o caldo quente aos poucos, mexendo.", "Quando o arroz estiver cremoso, misture os cogumelos e o parmesão."],
  },
  {
    slug: "lasanha-berinjela", title: "Lasanha de berinjela", category: "bake", prepTime: 55, servings: 6,
    description: "Camadas de berinjela assada, molho de tomate e queijo.",
    ingredients: [["berinjela", 3, "unidades"], ["molho de tomate", 500, "g"], ["muçarela", 250, "g"], ["parmesão", 50, "g"], ["manjericão", 10, "folhas"]],
    steps: ["Corte as berinjelas em fatias e asse por 15 minutos.", "Monte camadas de molho, berinjela e muçarela em um refratário.", "Finalize com parmesão e asse a 200 °C por 25 minutos."],
  },
  {
    slug: "yakisoba-legumes", title: "Yakisoba de legumes", category: "pasta", prepTime: 30, servings: 4,
    description: "Macarrão salteado com legumes crocantes e molho de soja.",
    ingredients: [["macarrão para yakisoba", 300, "g"], ["brócolis", 150, "g"], ["cenoura", 1, "unidade"], ["repolho", 150, "g"], ["molho shoyu", 60, "ml"]],
    steps: ["Cozinhe o macarrão conforme a embalagem e escorra.", "Salteie brócolis, cenoura e repolho em uma wok bem quente.", "Junte o macarrão e o shoyu e misture por 2 minutos."],
  },
  {
    slug: "moqueca-banana", title: "Moqueca de banana-da-terra", category: "soup", prepTime: 35, servings: 4,
    description: "Moqueca vegetal com leite de coco, pimentões e coentro.",
    ingredients: [["banana-da-terra", 4, "unidades"], ["leite de coco", 300, "ml"], ["tomate", 2, "unidades"], ["pimentão", 1, "unidade"], ["coentro", 15, "g"]],
    steps: ["Refogue tomate e pimentão em rodelas com azeite de dendê.", "Disponha as bananas em rodelas e cubra com leite de coco.", "Cozinhe tampado por 15 minutos e finalize com coentro."],
  },
  {
    slug: "feijao-tropeiro", title: "Feijão tropeiro", category: "rice", prepTime: 40, servings: 5,
    description: "Feijão, farinha, couve e ovos em um prato bem brasileiro.",
    ingredients: [["feijão cozido", 350, "g"], ["farinha de mandioca", 120, "g"], ["couve", 100, "g"], ["ovos", 2, "unidades"], ["bacon", 100, "g"]],
    steps: ["Doure o bacon e reserve parte da gordura na panela.", "Frite os ovos, junte o feijão escorrido e a couve fatiada.", "Acrescente a farinha aos poucos e misture até ficar soltinho."],
  },
  {
    slug: "estrogonofe-frango", title: "Estrogonofe de frango", category: "meal", prepTime: 35, servings: 4,
    description: "Frango em molho cremoso de tomate, mostarda e cogumelos.",
    ingredients: [["peito de frango", 500, "g"], ["champignon", 150, "g"], ["creme de leite", 200, "ml"], ["molho de tomate", 150, "g"], ["mostarda", 20, "g"]],
    steps: ["Doure o frango em cubos com cebola, sal e pimenta.", "Junte champignon, molho de tomate e mostarda e cozinhe por 10 minutos.", "Desligue o fogo, misture o creme de leite e sirva."],
  },
  {
    slug: "frango-xadrez", title: "Frango xadrez", category: "meal", prepTime: 35, servings: 4,
    description: "Cubos de frango com pimentões e molho oriental encorpado.",
    ingredients: [["peito de frango", 450, "g"], ["pimentão vermelho", 1, "unidade"], ["pimentão verde", 1, "unidade"], ["amendoim torrado", 60, "g"], ["molho shoyu", 50, "ml"]],
    steps: ["Doure o frango em cubos em uma frigideira grande.", "Acrescente os pimentões e salteie até ficarem macios, mas firmes.", "Junte shoyu e amendoim, misture e sirva com arroz."],
  },
  {
    slug: "carne-panela", title: "Carne de panela com batata", category: "meal", prepTime: 75, servings: 5,
    description: "Carne macia cozida lentamente com batatas e cenoura.",
    ingredients: [["acém em cubos", 700, "g"], ["batata", 400, "g"], ["cenoura", 2, "unidades"], ["cebola", 1, "unidade"], ["caldo de carne", 500, "ml"]],
    steps: ["Sele a carne em uma panela de pressão com a cebola.", "Cubra com caldo, tampe e cozinhe por 35 minutos após pegar pressão.", "Junte batata e cenoura e cozinhe sem pressão até ficarem macias."],
  },
  {
    slug: "almondegas-sugo", title: "Almôndegas ao sugo", category: "meal", prepTime: 45, servings: 4,
    description: "Almôndegas douradas terminadas em molho de tomate caseiro.",
    ingredients: [["carne moída", 500, "g"], ["farinha de rosca", 40, "g"], ["ovo", 1, "unidade"], ["molho de tomate", 400, "g"], ["parmesão", 30, "g"]],
    steps: ["Misture carne, farinha de rosca, ovo, sal e pimenta e modele bolinhas.", "Doure as almôndegas em uma frigideira com um fio de azeite.", "Cubra com molho de tomate e cozinhe por 15 minutos."],
  },
  {
    slug: "peixe-assado-limao", title: "Peixe assado com limão", category: "fish", prepTime: 40, servings: 4,
    description: "Filés assados com ervas, limão e cebola.",
    ingredients: [["filé de tilápia", 600, "g"], ["limão", 2, "unidades"], ["cebola", 1, "unidade"], ["azeite", 30, "ml"], ["tomilho", 5, "ramos"]],
    steps: ["Tempere os filés com limão, sal, pimenta e tomilho.", "Disponha sobre cebola em rodelas em uma assadeira untada.", "Asse a 200 °C por 20 minutos e sirva com o caldo da assadeira."],
  },
  {
    slug: "escondidinho-carne-seca", title: "Escondidinho de carne-seca", category: "bake", prepTime: 65, servings: 6,
    description: "Purê de mandioca gratinado com recheio de carne-seca.",
    ingredients: [["mandioca", 700, "g"], ["carne-seca dessalgada", 400, "g"], ["requeijão", 100, "g"], ["leite", 120, "ml"], ["queijo coalho", 120, "g"]],
    steps: ["Cozinhe a mandioca até ficar macia e amasse com leite e manteiga.", "Refogue a carne-seca desfiada com cebola e misture o requeijão.", "Monte purê, recheio e queijo em camadas e gratine por 20 minutos."],
  },
  {
    slug: "baiao-dois", title: "Baião de dois", category: "rice", prepTime: 50, servings: 6,
    description: "Arroz e feijão-de-corda unidos com queijo coalho e coentro.",
    ingredients: [["arroz", 250, "g"], ["feijão-de-corda cozido", 300, "g"], ["queijo coalho", 150, "g"], ["cebola", 1, "unidade"], ["coentro", 15, "g"]],
    steps: ["Refogue a cebola e junte o arroz cru e água quente.", "Quando o arroz estiver quase cozido, acrescente o feijão e misture.", "Finalize com queijo coalho em cubos e coentro picado."],
  },
  {
    slug: "arroz-carreteiro", title: "Arroz carreteiro", category: "rice", prepTime: 45, servings: 5,
    description: "Arroz bem temperado com carne-seca desfiada e cheiro-verde.",
    ingredients: [["arroz", 300, "g"], ["carne-seca dessalgada", 350, "g"], ["tomate", 2, "unidades"], ["cebola", 1, "unidade"], ["caldo de carne", 700, "ml"]],
    steps: ["Doure a carne-seca desfiada com cebola em uma panela.", "Junte tomate e arroz e refogue por 2 minutos.", "Acrescente o caldo quente e cozinhe até o arroz ficar macio."],
  },
  {
    slug: "torta-legumes", title: "Torta de legumes de liquidificador", category: "bake", prepTime: 55, servings: 8,
    description: "Torta prática com massa leve e recheio de legumes coloridos.",
    ingredients: [["farinha de trigo", 250, "g"], ["leite", 300, "ml"], ["ovos", 3, "unidades"], ["abobrinha", 1, "unidade"], ["cenoura", 1, "unidade"]],
    steps: ["Bata leite, ovos, farinha, óleo e fermento até obter uma massa lisa.", "Misture os legumes picados e tempere com sal e ervas.", "Despeje em forma untada e asse a 180 °C por 40 minutos."],
  },
  {
    slug: "pizza-frigideira", title: "Pizza de frigideira", category: "bake", prepTime: 25, servings: 2,
    description: "Pizza individual com massa rápida e cobertura de queijo.",
    ingredients: [["farinha de trigo", 160, "g"], ["iogurte natural", 100, "g"], ["molho de tomate", 80, "g"], ["muçarela", 100, "g"], ["orégano", 2, "g"]],
    steps: ["Misture farinha, iogurte e sal até formar uma massa macia.", "Abra dois discos e doure cada um em frigideira tampada.", "Espalhe molho, queijo e orégano e aqueça até derreter."],
  },
  {
    slug: "quiche-alho-poro", title: "Quiche de alho-poró", category: "bake", prepTime: 65, servings: 8,
    description: "Massa amanteigada com recheio cremoso de alho-poró.",
    ingredients: [["farinha de trigo", 220, "g"], ["manteiga", 100, "g"], ["alho-poró", 2, "unidades"], ["ovos", 3, "unidades"], ["creme de leite", 200, "ml"]],
    steps: ["Misture farinha e manteiga gelada até formar uma farofa e forre uma forma.", "Refogue o alho-poró e espalhe sobre a massa pré-assada.", "Cubra com ovos batidos e creme de leite e asse por 35 minutos."],
  },
  {
    slug: "pao-caseiro", title: "Pão caseiro fofinho", category: "bread", prepTime: 150, servings: 10,
    description: "Pão dourado de fermentação simples para o café da tarde.",
    ingredients: [["farinha de trigo", 500, "g"], ["leite morno", 250, "ml"], ["fermento biológico seco", 10, "g"], ["açúcar", 35, "g"], ["manteiga", 40, "g"]],
    steps: ["Misture leite, fermento e açúcar e aguarde 5 minutos.", "Junte farinha, manteiga e sal e sove por 10 minutos.", "Deixe crescer até dobrar, modele e asse a 180 °C por 35 minutos."],
  },
  {
    slug: "bolo-cenoura", title: "Bolo de cenoura com cobertura", category: "cake", prepTime: 60, servings: 10,
    description: "Bolo úmido de cenoura com cobertura brilhante de chocolate.",
    ingredients: [["cenoura", 300, "g"], ["farinha de trigo", 250, "g"], ["ovos", 3, "unidades"], ["açúcar", 220, "g"], ["chocolate em pó", 40, "g"]],
    steps: ["Bata cenoura, ovos, açúcar e óleo no liquidificador.", "Misture com a farinha e o fermento e asse a 180 °C por 40 minutos.", "Cozinhe chocolate, açúcar e manteiga para a cobertura e espalhe no bolo frio."],
  },
  {
    slug: "bolo-fuba", title: "Bolo de fubá com erva-doce", category: "cake", prepTime: 55, servings: 10,
    description: "Bolo macio de fubá perfumado com erva-doce.",
    ingredients: [["fubá", 220, "g"], ["farinha de trigo", 120, "g"], ["leite", 250, "ml"], ["ovos", 3, "unidades"], ["erva-doce", 5, "g"]],
    steps: ["Bata ovos, leite, açúcar e óleo até misturar.", "Acrescente fubá, farinha, fermento e erva-doce.", "Asse em forma untada a 180 °C por 40 minutos."],
  },
  {
    slug: "brownie-chocolate", title: "Brownie de chocolate", category: "cake", prepTime: 40, servings: 9,
    description: "Brownie intenso com casquinha fina e interior úmido.",
    ingredients: [["chocolate meio amargo", 200, "g"], ["manteiga", 120, "g"], ["açúcar", 180, "g"], ["ovos", 3, "unidades"], ["farinha de trigo", 90, "g"]],
    steps: ["Derreta o chocolate com a manteiga e misture o açúcar.", "Incorpore os ovos e a farinha sem bater demais.", "Asse a 180 °C por 25 minutos e espere esfriar antes de cortar."],
  },
  {
    slug: "brigadeiro", title: "Brigadeiro tradicional", category: "dessert", prepTime: 30, servings: 20,
    description: "Doce brasileiro de chocolate enrolado em granulado.",
    ingredients: [["leite condensado", 395, "g"], ["chocolate em pó", 30, "g"], ["manteiga", 15, "g"], ["granulado", 80, "g"]],
    steps: ["Misture leite condensado, chocolate e manteiga em uma panela.", "Cozinhe em fogo baixo, mexendo, até desgrudar do fundo.", "Espere esfriar, enrole bolinhas e passe no granulado."],
  },
  {
    slug: "pudim-leite", title: "Pudim de leite condensado", category: "dessert", prepTime: 90, servings: 10,
    description: "Pudim liso com calda de caramelo feita na própria forma.",
    ingredients: [["leite condensado", 395, "g"], ["leite", 400, "ml"], ["ovos", 3, "unidades"], ["açúcar", 180, "g"]],
    steps: ["Derreta o açúcar na forma até virar caramelo e espalhe pelas laterais.", "Bata leite condensado, leite e ovos e despeje na forma.", "Asse em banho-maria a 180 °C por 70 minutos e gele antes de desenformar."],
  },
  {
    slug: "mousse-maracuja", title: "Mousse de maracujá", category: "dessert", prepTime: 15, servings: 6,
    description: "Mousse aerada de três ingredientes com calda da fruta.",
    ingredients: [["polpa de maracujá", 200, "ml"], ["leite condensado", 395, "g"], ["creme de leite", 200, "ml"], ["açúcar", 30, "g"]],
    steps: ["Bata a polpa, o leite condensado e o creme de leite por 2 minutos.", "Distribua em taças e leve à geladeira por 3 horas.", "Ferva a polpa restante com açúcar e coloque sobre a mousse fria."],
  },
  {
    slug: "cocada-cremosa", title: "Cocada cremosa", category: "dessert", prepTime: 30, servings: 8,
    description: "Coco fresco cozido lentamente com leite condensado.",
    ingredients: [["coco fresco ralado", 250, "g"], ["leite condensado", 395, "g"], ["leite de coco", 100, "ml"], ["manteiga", 10, "g"]],
    steps: ["Coloque todos os ingredientes em uma panela de fundo grosso.", "Cozinhe em fogo baixo, mexendo, até ficar cremosa e encorpada.", "Sirva morna ou espere esfriar para firmar."],
  },
  {
    slug: "beijinho", title: "Beijinho de coco", category: "dessert", prepTime: 30, servings: 20,
    description: "Docinho de coco enrolado e finalizado com cravo.",
    ingredients: [["leite condensado", 395, "g"], ["coco ralado", 100, "g"], ["manteiga", 15, "g"], ["cravo-da-índia", 20, "unidades"]],
    steps: ["Misture leite condensado, coco e manteiga em uma panela.", "Cozinhe em fogo baixo até desgrudar do fundo e deixe esfriar.", "Enrole, passe no coco ralado e finalize com um cravo."],
  },
  {
    slug: "canjica", title: "Canjica cremosa", category: "dessert", prepTime: 75, servings: 8,
    description: "Milho branco macio com leite, canela e amendoim.",
    ingredients: [["canjica branca", 250, "g"], ["leite", 700, "ml"], ["leite condensado", 200, "g"], ["canela em pau", 2, "unidades"], ["amendoim torrado", 50, "g"]],
    steps: ["Deixe a canjica de molho por 8 horas e escorra.", "Cozinhe na pressão com água por 35 minutos e escorra.", "Junte leite, leite condensado e canela e cozinhe até engrossar."],
  },
  {
    slug: "arroz-doce", title: "Arroz-doce com canela", category: "dessert", prepTime: 45, servings: 6,
    description: "Arroz cremoso cozido no leite e polvilhado com canela.",
    ingredients: [["arroz", 180, "g"], ["água", 500, "ml"], ["leite", 700, "ml"], ["açúcar", 100, "g"], ["canela em pó", 3, "g"]],
    steps: ["Cozinhe o arroz na água até ficar quase macio.", "Acrescente leite e açúcar e mexa em fogo baixo até ficar cremoso.", "Sirva morno ou gelado com canela por cima."],
  },
  {
    slug: "cookies-aveia", title: "Cookies de aveia e passas", category: "cookie", prepTime: 30, servings: 16,
    description: "Biscoitos macios com aveia, canela e uvas-passas.",
    ingredients: [["aveia em flocos", 160, "g"], ["farinha de trigo", 100, "g"], ["manteiga", 90, "g"], ["açúcar mascavo", 100, "g"], ["uva-passa", 70, "g"]],
    steps: ["Misture manteiga e açúcar mascavo e incorpore a farinha e a aveia.", "Junte as passas, modele porções e achate em uma assadeira.", "Asse a 180 °C por 12 minutos e deixe esfriar."],
  },
  {
    slug: "panqueca-americana", title: "Panqueca americana", category: "cake", prepTime: 25, servings: 4,
    description: "Panquecas altas e douradas para servir com frutas e mel.",
    ingredients: [["farinha de trigo", 200, "g"], ["leite", 240, "ml"], ["ovo", 1, "unidade"], ["açúcar", 25, "g"], ["fermento químico", 10, "g"]],
    steps: ["Misture farinha, açúcar e fermento em uma tigela.", "Adicione leite e ovo e mexa apenas até a massa ficar homogênea.", "Doure pequenas porções em frigideira e vire quando surgirem bolhas."],
  },
  {
    slug: "waffle-baunilha", title: "Waffle de baunilha", category: "cake", prepTime: 25, servings: 4,
    description: "Waffles crocantes por fora e macios por dentro.",
    ingredients: [["farinha de trigo", 220, "g"], ["leite", 250, "ml"], ["ovos", 2, "unidades"], ["manteiga derretida", 50, "g"], ["extrato de baunilha", 5, "ml"]],
    steps: ["Misture farinha e fermento e, em outro recipiente, bata leite, ovos e manteiga.", "Una os ingredientes e acrescente a baunilha.", "Cozinhe porções na máquina de waffle até dourarem."],
  },
  {
    slug: "limonada", title: "Limonada suíça", category: "drink", prepTime: 10, servings: 4,
    description: "Limonada batida com casca, gelo e leite condensado.",
    ingredients: [["limão", 3, "unidades"], ["água gelada", 800, "ml"], ["leite condensado", 80, "ml"], ["gelo", 200, "g"]],
    steps: ["Lave os limões, corte em pedaços e retire as sementes.", "Bata rapidamente com água e gelo e coe em seguida.", "Misture o leite condensado e sirva imediatamente."],
  },
  {
    slug: "cha-hibisco", title: "Chá gelado de hibisco", category: "drink", prepTime: 15, servings: 4,
    description: "Infusão rubi refrescante com laranja e hortelã.",
    ingredients: [["hibisco seco", 20, "g"], ["água", 1, "litro"], ["laranja", 1, "unidade"], ["mel", 30, "ml"], ["hortelã", 8, "folhas"]],
    steps: ["Ferva a água, desligue e adicione o hibisco por 8 minutos.", "Coe, misture o mel e deixe esfriar.", "Sirva com rodelas de laranja, hortelã e gelo."],
  },
  {
    slug: "chocolate-quente", title: "Chocolate quente cremoso", category: "drink", prepTime: 15, servings: 2,
    description: "Bebida quente de chocolate com textura aveludada.",
    ingredients: [["leite", 500, "ml"], ["chocolate meio amargo", 100, "g"], ["cacau em pó", 15, "g"], ["amido de milho", 8, "g"], ["açúcar", 20, "g"]],
    steps: ["Dissolva o amido e o cacau em parte do leite frio.", "Aqueça o restante com o chocolate e o açúcar até derreter.", "Junte a mistura de amido e mexa até engrossar levemente."],
  },
];

const palettes = [
  ["#f3d9b1", "#b75b3e", "#6f8e53"], ["#e8d6c6", "#d27a4b", "#5a8b76"],
  ["#dce7d2", "#71894c", "#d6a64f"], ["#f4dfc8", "#bd624e", "#6a9364"],
  ["#e6dcf3", "#78639a", "#c48b51"], ["#d8e8e7", "#4d8781", "#d2a74e"],
  ["#f2dfbf", "#b96c45", "#768f5c"], ["#ead1c8", "#a95043", "#71875b"],
  ["#dce1ed", "#65779a", "#c98458"], ["#e8e0c3", "#9d7846", "#638767"],
];

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function xmlText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function illustration(recipe, index) {
  const [background, food, accent] = palettes[index % palettes.length];
  const isDrink = recipe.category === "drink";
  const isBread = recipe.category === "bread" || recipe.category === "cookie";
  const isDessert = ["cake", "dessert", "cookie"].includes(recipe.category);
  const vessel = isDrink
    ? `<path d="M255 95h130l-18 205a22 22 0 0 1-22 20h-50a22 22 0 0 1-22-20z" fill="#fffdf7" opacity=".94"/><path d="M269 125h102l-13 148h-77z" fill="${food}"/><path d="m340 65 34 49" stroke="${accent}" stroke-width="12" stroke-linecap="round"/>`
    : isBread
      ? `<ellipse cx="320" cy="210" rx="190" ry="118" fill="#fffdf7" opacity=".92"/><path d="M190 238c0-66 44-111 104-111 33 0 55 15 68 39 48 0 86 37 86 82 0 38-32 66-75 66H260c-42 0-70-29-70-76z" fill="${food}"/><path d="m258 160 24 48m35-59 18 42m35-26 14 35" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>`
      : isDessert
        ? `<ellipse cx="320" cy="265" rx="183" ry="52" fill="#fffdf7" opacity=".92"/><path d="M207 235V165l113-63 113 63v70z" fill="${food}"/><path d="m207 165 113 66 113-66-113-63z" fill="${accent}"/><path d="M207 195 320 260l113-65" fill="none" stroke="#fff4d9" stroke-width="12" opacity=".8"/>`
        : `<ellipse cx="320" cy="215" rx="194" ry="125" fill="#fffdf7" opacity=".92"/><ellipse cx="320" cy="208" rx="151" ry="88" fill="${food}"/><path d="M205 211c33-53 77-72 114-40 40-48 83-24 110 17-28 48-69 76-122 71-45 0-78-16-102-48z" fill="${accent}" opacity=".72"/>`;
  const garnish = Array.from({ length: 7 }, (_, dot) => {
    const x = 245 + ((index * 37 + dot * 43) % 150);
    const y = 172 + ((index * 19 + dot * 29) % 75);
    const color = dot % 2 ? accent : "#f7e9be";
    return `<circle cx="${x}" cy="${y}" r="${dot % 3 === 0 ? 11 : 7}" fill="${color}" opacity=".9"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" role="img" aria-labelledby="title">
  <title id="title">${xmlText(recipe.title)}</title>
  <rect width="640" height="400" fill="${background}"/>
  <circle cx="520" cy="70" r="115" fill="#fffdf7" opacity=".22"/>
  <circle cx="84" cy="330" r="150" fill="${accent}" opacity=".12"/>
  ${vessel}${garnish}
  <rect x="22" y="338" width="596" height="42" rx="12" fill="#fffdf7" opacity=".9"/>
  <text x="42" y="365" fill="#313b32" font-family="Arial,sans-serif" font-size="17" font-weight="700">${xmlText(recipe.title)}</text>
</svg>`;
}

function buildMigration() {
  const recipeRows = recipes.map((recipe, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const titleKey = recipe.title.normalize("NFKC").toLowerCase();
    const imageUrl = `/images/recipes/${recipe.slug}.svg`;
    return `(${sqlString(id)}, ${sqlString(editorialUserId)}, ${sqlString(recipe.title)}, ${sqlString(titleKey)}, ${sqlString(imageUrl)}, ${sqlString(recipe.description)}, ${recipe.prepTime}, ${recipe.servings})`;
  });
  const ingredientRows = [];
  const stepRows = [];
  recipes.forEach((recipe, index) => {
    const recipeId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    recipe.ingredients.forEach(([name, quantity, unit], position) => {
      ingredientRows.push(`(${sqlString(recipeId)}, ${position + 1}, ${sqlString(name)}, ${sqlString(name.normalize("NFKC").toLowerCase())}, ${quantity}, ${sqlString(unit)})`);
    });
    recipe.steps.forEach((content, position) => {
      stepRows.push(`(${sqlString(recipeId)}, ${position + 1}, ${sqlString(content)})`);
    });
  });
  return `ALTER TABLE recipes ADD COLUMN image_url TEXT NOT NULL DEFAULT '/images/recipes/placeholder.svg';

INSERT OR IGNORE INTO discord_users (user_id, username, avatar)
VALUES (${sqlString(editorialUserId)}, 'Caderno Panela', NULL);

INSERT OR IGNORE INTO recipes (id, author_user_id, title, title_key, image_url, description, prep_time, servings)
VALUES
${recipeRows.join(",\n")};

INSERT OR IGNORE INTO recipe_ingredients (recipe_id, position, name, name_key, quantity, unit)
VALUES
${ingredientRows.join(",\n")};

INSERT OR IGNORE INTO recipe_steps (recipe_id, position, content)
VALUES
${stepRows.join(",\n")};
`;
}

const imageDirectory = path.join(root, "public", "images", "recipes");
await fs.mkdir(imageDirectory, { recursive: true });
await fs.writeFile(path.join(imageDirectory, "placeholder.svg"), illustration({
  title: "Uma receita da comunidade",
  category: "meal",
}, 0));
for (const [index, recipe] of recipes.entries()) {
  await fs.writeFile(path.join(imageDirectory, `${recipe.slug}.svg`), illustration(recipe, index));
}
await fs.mkdir(path.join(root, "migrations"), { recursive: true });
await fs.writeFile(path.join(root, "migrations", "0003_seed_catalog.sql"), buildMigration());

console.log(`Generated ${recipes.length} recipes, ${recipes.length + 1} illustrations and migration 0003_seed_catalog.sql.`);
