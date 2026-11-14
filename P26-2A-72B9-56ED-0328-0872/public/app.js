// --- VARIÁVEIS DO CRONÓMETRO ---
let timerInterval = null;
let startTime = 0;
let elapsedTime = 0;

// --- ELEMENTOS DO DOM ---
const displayTimer = document.getElementById('displayTimer');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const formManual = document.getElementById('formManual');
const faseProjeto = document.getElementById('faseProjeto');
const horasTrabalhadas = document.getElementById('horasTrabalhadas');

function formatTime(timeInMs) {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0')
    ].join(':');
}

function updateDisplay() {
    const currentTime = Date.now();
    const timeToDisplay = elapsedTime + (currentTime - startTime);
    displayTimer.textContent = formatTime(timeToDisplay);
}

// --- GRAVAR APONTAMENTO NA BASE DE DADOS D1 ---
async function registarApontamento(fase, horasGastas, tipoRegistro) {
    const resposta = await fetch('/api/apontamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fase,
            horas_gastas: horasGastas,
            tipo_registro: tipoRegistro
        })
    });

    const dados = await resposta.json();
    if (!resposta.ok || !dados.ok) {
        throw new Error(dados.error || 'Erro ao guardar apontamento na base de dados.');
    }
}

// --- EVENTOS DO CRONÓMETRO ---
btnStart.addEventListener('click', () => {
    if (!timerInterval) {
        startTime = Date.now();
        timerInterval = setInterval(updateDisplay, 1000);
        btnStart.disabled = true;
        btnStart.style.backgroundColor = '#95a5a6';
    }
});

btnStop.addEventListener('click', async () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedTime += Date.now() - startTime;
        btnStart.disabled = false;
        btnStart.style.backgroundColor = '';
    }

    if (elapsedTime < 1000) {
        alert('Inicie o cronómetro por pelo menos 1 segundo antes de salvar.');
        return;
    }

    // Converte milissegundos para horas (mínimo de 0.01h para registos rápidos de teste)
    const horasCalculadas = Math.max(0.01, Number((elapsedTime / 3600000).toFixed(4)));
    const faseSelecionada = faseProjeto.value;

    try {
        await registarApontamento(faseSelecionada, horasCalculadas, 'cronometro');
        alert(`Tempo de ${formatTime(elapsedTime)} (${horasCalculadas}h) gravado na etapa "${faseSelecionada}"!`);
        elapsedTime = 0;
        displayTimer.textContent = '00:00:00';
        await carregarDashboard();
    } catch (erro) {
        alert(erro.message);
    }
});

// --- EVENTO: LANÇAMENTO MANUAL DE HORAS ---
formManual.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fase = faseProjeto.value;
    const horas = parseFloat(horasTrabalhadas.value);

    if (!Number.isFinite(horas) || horas <= 0) {
        alert('Por favor, insira um valor válido de horas.');
        return;
    }

    try {
        await registarApontamento(fase, horas, 'manual');
        alert(`Lançamento manual de ${horas}h na etapa "${fase}" gravado com sucesso!`);
        formManual.reset();
        await carregarDashboard();
    } catch (erro) {
        alert(erro.message);
    }
});

// --- PAINEL ANALÍTICO DA EQUIPA (DADOS REAIS DO D1) ---
const nomesEtapas = {
    Requisitos: 'Requisitos',
    Arquitetura: 'Arquitetura',
    Codificacao: 'Codificação',
    Testes: 'Testes'
};

async function carregarDashboard() {
    const tabelaCorpo = document.getElementById('tabelaCorpo');

    try {
        const resposta = await fetch('/api/apontamentos');
        const dados = await resposta.json();

        if (!dados.ok || !Array.isArray(dados.resumo)) return;

        tabelaCorpo.innerHTML = '';

        dados.resumo.forEach((dado) => {
            const estimado = Number(dado.horas_estimadas);
            const real = Number(Number(dado.horas_reais).toFixed(2));
            const desvio = Number((estimado - real).toFixed(2));
            const corDesvio = desvio < 0 ? 'color: red; font-weight: bold;' : 'color: green;';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${nomesEtapas[dado.fase] || dado.fase}</td>
                <td>${estimado}h</td>
                <td>${real}h</td>
                <td style="${corDesvio}">${desvio >= 0 ? '+' : ''}${desvio}h</td>
            `;
            tabelaCorpo.appendChild(tr);
        });
    } catch (erro) {
        console.error('Erro ao carregar o painel analítico:', erro);
    }
}

// --- AUTENTICAÇÃO E SESSÃO DISCORD ---
const btnLoginDiscord = document.getElementById('btnLoginDiscord');
if (btnLoginDiscord) {
    btnLoginDiscord.addEventListener('click', () => {
        window.location.href = '/api/auth/discord';
    });
}

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
carregarDashboard();