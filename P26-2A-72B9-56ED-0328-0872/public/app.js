// Variáveis do Cronómetro
let timerInterval = null;
let startTime = 0;
let elapsedTime = 0;

// Elementos do DOM
const displayTimer = document.getElementById('displayTimer');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');

// Função para formatar o tempo em HH:MM:SS
function formatTime(timeInMs) {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

// Atualizar o ecrã do cronómetro
function updateDisplay() {
    const currentTime = Date.now();
    const timeToDisplay = elapsedTime + (currentTime - startTime);
    displayTimer.textContent = formatTime(timeToDisplay);
}

// Evento: Iniciar Cronómetro
btnStart.addEventListener('click', () => {
    if (!timerInterval) {
        startTime = Date.now();
        timerInterval = setInterval(updateDisplay, 1000); // Atualiza a cada segundo
        btnStart.disabled = true; // Impede duplo clique
        btnStart.style.backgroundColor = '#95a5a6'; // Estilo visual de desativado
    }
});

// Evento: Parar Cronómetro
btnStop.addEventListener('click', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedTime += Date.now() - startTime;
        btnStart.disabled = false;
        btnStart.style.backgroundColor = ''; // Restaura o estilo
        
        // No futuro (Etapa 5), este botão enviará o tempo para a Cloudflare Function
        alert(`O tempo de ${formatTime(elapsedTime)} foi parado. Posteriormente será gravado no banco de dados D1.`);
    }
});

// --- CONTINUAÇÃO DO APP.JS ---

// Elementos do Formulário Manual
const formManual = document.getElementById('formManual');
const faseProjeto = document.getElementById('faseProjeto');
const horasTrabalhadas = document.getElementById('horasTrabalhadas');

// Evento: Lançamento Manual de Horas
formManual.addEventListener('submit', (event) => {
    event.preventDefault(); // Impede o recarregamento da página (comportamento padrão do HTML)

    const fase = faseProjeto.value;
    const horas = parseFloat(horasTrabalhadas.value);

    if (horas > 0) {
        alert(`Lançamento manual de ${horas}h na etapa de "${fase}" registado localmente. Posteriormente será gravado na base de dados D1.`);
        formManual.reset(); // Limpa o formulário após o lançamento
    } else {
        alert('Por favor, insira um valor válido de horas.');
    }
});

// Mock (Simulação) do Painel Analítico
// Esta função cria dados fictícios para podermos visualizar a estrutura antes de integrar com o D1
function atualizarPainelMock() {
    const tabelaCorpo = document.getElementById('tabelaCorpo');
    
    // Simulação dos dados que virão do Backend (Cloudflare D1) futuramente
    const dadosMock = [
        { modulo: 'Requisitos', estimado: 20, real: 5 },
        { modulo: 'Arquitetura', estimado: 15, real: 16 }, // Exemplo de atraso
        { modulo: 'Codificação', estimado: 40, real: 12.5 },
        { modulo: 'Testes', estimado: 25, real: 0 }
    ];

    tabelaCorpo.innerHTML = ''; // Limpa a tabela antes de preencher

    dadosMock.forEach(dado => {
        const desvio = dado.estimado - dado.real;
        // Se o desvio for negativo (gastou mais tempo do que o estimado), fica vermelho.
        const corDesvio = desvio < 0 ? 'color: red; font-weight: bold;' : 'color: green;';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dado.modulo}</td>
            <td>${dado.estimado}h</td>
            <td>${dado.real}h</td>
            <td style="${corDesvio}">${desvio >= 0 ? '+' : ''}${desvio}h</td>
        `;
        tabelaCorpo.appendChild(tr);
    });
}

// Inicializa a tabela ao carregar a página
atualizarPainelMock();

// --- AUTENTICAÇÃO DISCORD ---
const btnLoginDiscord = document.getElementById('btnLoginDiscord');

if (btnLoginDiscord) {
    btnLoginDiscord.addEventListener('click', () => {
        // Redireciona o utilizador para a nossa Cloudflare Function que preparámos
        window.location.href = '/api/auth/discord';
    });
}

// --- VERIFICAÇÃO DE SESSÃO ATIVA ---
async function verificarSessao() {
    try {
        const resposta = await fetch('/api/status');
        const dados = await resposta.json();

        const utilizador = dados.sessionUser;

        if (utilizador && (utilizador.username || utilizador.userId)) {
            const btnLogin = document.getElementById('btnLoginDiscord');
            const userInfo = document.getElementById('userInfo');
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');

            if (btnLogin) btnLogin.style.display = 'none';
            if (userInfo) {
                userInfo.style.display = 'flex';
                userInfo.style.alignItems = 'center';
                userInfo.style.gap = '10px';
            }
            if (userName) {
                userName.textContent = utilizador.username || 'Utilizador';
            }
            if (userAvatar) {
                userAvatar.src = utilizador.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
                userAvatar.style.borderRadius = '50%';
            }
        }
    } catch (erro) {
        console.log('Nenhuma sessão ativa encontrada:', erro);
    }
}

verificarSessao();