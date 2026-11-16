/**
 * script.js - Lógica da aplicação Diário de Bordo de Projetos
 * Autenticação Discord OAuth2, registo de logs no servidor (UTC), filtros via API e timeline
 */

(function() {
    'use strict';

    const MAX_CONTEUDO = 2000;

    const state = {
        user: null,
        logs: [],
        filters: {
            busca: '',
            impedimento: '',
            inicio: '',
            fim: ''
        }
    };

    const elements = {
        authArea: document.getElementById('auth-area'),
        authFeedback: document.getElementById('auth-feedback'),
        formSection: document.getElementById('form-section'),
        filtersSection: document.getElementById('filters-section'),
        logForm: document.getElementById('log-form'),
        conteudo: document.getElementById('conteudo'),
        charCount: document.getElementById('char-count'),
        impedimento: document.getElementById('impedimento'),
        formFeedback: document.getElementById('form-feedback'),
        submitBtn: document.getElementById('submit-btn'),
        filtersForm: document.getElementById('filters-form'),
        busca: document.getElementById('busca'),
        filtroImpedimento: document.getElementById('filtro-impedimento'),
        inicio: document.getElementById('inicio'),
        fim: document.getElementById('fim'),
        clearFilters: document.getElementById('clear-filters'),
        timeline: document.getElementById('timeline')
    };

    const api = {
        async get(url) {
            const res = await fetch(url, {
                credentials: 'include'
            });
            if (!res.ok) {
                if (res.status === 401) return { unauthorized: true, data: null };
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody.error || `HTTP ${res.status}`);
            }
            return { unauthorized: false, data: await res.json() };
        },

        async post(url, data) {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return body;
        }
    };

    function showFeedback(el, message, type) {
        if (!el) return;
        if (!message) {
            el.textContent = '';
            el.className = 'feedback hidden';
            return;
        }
        el.textContent = message;
        el.className = `feedback ${type}`;
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr || '';
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getImpedimentoLabel(value) {
        const labels = {
            sem: 'Sem impedimento',
            atencao: 'Atenção',
            bloqueado: 'Bloqueado'
        };
        return labels[value] || value;
    }

    function getFallbackAvatarUrl(userId) {
        let index = 0;
        if (userId) {
            const tail = String(userId).slice(-4);
            const parsed = Number.parseInt(tail, 10);
            if (!Number.isNaN(parsed)) {
                index = Math.abs(parsed) % 5;
            }
        }
        return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    }

    function getAvatarUrl(userId, avatarHash) {
        if (!avatarHash) {
            return getFallbackAvatarUrl(userId);
        }
        const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}`;
    }

    function createAvatarImg(userId, avatarHash, size = 36) {
        const img = document.createElement('img');
        img.src = getAvatarUrl(userId, avatarHash);
        img.alt = 'Avatar do Discord';
        img.className = 'avatar';
        img.width = size;
        img.height = size;
        img.loading = 'lazy';
        img.onerror = function() {
            this.src = getFallbackAvatarUrl(userId);
            this.onerror = null;
        };
        return img;
    }

    function updateCharCount() {
        const length = elements.conteudo.value.length;
        elements.charCount.textContent = `${length} / ${MAX_CONTEUDO}`;
    }

    function checkUrlAuthError() {
        const params = new URLSearchParams(window.location.search);
        const authError = params.get('auth_error');
        if (!authError) return;

        const messages = {
            access_denied: 'Autenticação no Discord cancelada pelo usuário.',
            invalid_state: 'Falha na validação de segurança OAuth2 (state inválido). Tente novamente.',
            missing_code: 'Código de autorização OAuth2 ausente.',
            token_exchange_failed: 'Não foi possível validar o token com o Discord.',
            fetch_user_failed: 'Não foi possível obter os dados do perfil no Discord.',
            callback_exception: 'Erro inesperado durante o login com o Discord.'
        };
        showFeedback(
            elements.authFeedback,
            messages[authError] || 'Erro ao autenticar com o Discord. Tente novamente.',
            'error'
        );

        params.delete('auth_error');
        const cleanQuery = params.toString();
        const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '');
        window.history.replaceState({}, '', cleanUrl);
    }

    function setAuthenticatedUI(authenticated) {
        elements.formSection.classList.toggle('hidden', !authenticated);
        elements.filtersSection.classList.toggle('hidden', !authenticated);
    }

    async function checkAuth() {
        try {
            const { unauthorized, data: user } = await api.get('/api/auth/me');
            state.user = unauthorized ? null : user;
            renderAuthArea();

            if (state.user) {
                setAuthenticatedUI(true);
                await loadLogs();
            } else {
                setAuthenticatedUI(false);
                renderEmptyTimeline('Entre com sua conta do Discord para registrar atividades e visualizar seu diário de bordo.');
            }
        } catch (err) {
            console.error('Erro ao verificar autenticação:', err);
            setAuthenticatedUI(false);
            renderEmptyTimeline('Não foi possível verificar a sessão no momento.');
        }
    }

    async function handleLogout() {
        try {
            await fetch('/api/auth/me?logout=1', { credentials: 'include' });
        } catch (err) {
            console.error('Erro ao encerrar sessão:', err);
        }
        state.user = null;
        state.logs = [];
        renderAuthArea();
        setAuthenticatedUI(false);
        showFeedback(elements.formFeedback, '', '');
        renderEmptyTimeline('Sessão encerrada. Entre com o Discord para acessar seu diário de bordo.');
    }

    function renderAuthArea() {
        const area = elements.authArea;
        area.textContent = '';

        if (state.user) {
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';

            const avatar = createAvatarImg(state.user.user_id, state.user.avatar, 36);
            userInfo.appendChild(avatar);

            const name = document.createElement('span');
            name.className = 'username';
            name.textContent = state.user.username || 'Usuário';
            userInfo.appendChild(name);

            area.appendChild(userInfo);

            const logoutBtn = document.createElement('button');
            logoutBtn.type = 'button';
            logoutBtn.className = 'btn btn-danger';
            logoutBtn.textContent = 'Sair';
            logoutBtn.addEventListener('click', handleLogout);
            area.appendChild(logoutBtn);
        } else {
            const loginBtn = document.createElement('a');
            loginBtn.href = '/api/auth/login';
            loginBtn.className = 'btn btn-primary';
            loginBtn.textContent = 'Entrar com Discord';
            area.appendChild(loginBtn);
        }
    }

    function buildLogsUrl() {
        const params = new URLSearchParams();
        if (state.filters.busca.trim()) {
            params.set('busca', state.filters.busca.trim());
        }
        if (state.filters.impedimento) {
            params.set('impedimento', state.filters.impedimento);
        }
        if (state.filters.inicio) {
            params.set('inicio', state.filters.inicio);
        }
        if (state.filters.fim) {
            params.set('fim', state.filters.fim);
        }
        const qs = params.toString();
        return qs ? `/api/logs?${qs}` : '/api/logs';
    }

    async function loadLogs() {
        try {
            renderEmptyTimeline('Carregando registros...');
            const { unauthorized, data } = await api.get(buildLogsUrl());

            if (unauthorized) {
                state.user = null;
                renderAuthArea();
                setAuthenticatedUI(false);
                renderEmptyTimeline('Sua sessão expirou. Entre novamente com o Discord.');
                return;
            }

            state.logs = Array.isArray(data) ? data : [];
            renderTimeline();
        } catch (err) {
            console.error('Erro ao carregar logs:', err);
            renderEmptyTimeline(`Erro ao carregar registros: ${err.message}`);
        }
    }

    async function handleFilterSubmit(e) {
        e.preventDefault();
        state.filters.busca = elements.busca.value;
        state.filters.impedimento = elements.filtroImpedimento.value;
        state.filters.inicio = elements.inicio.value;
        state.filters.fim = elements.fim.value;

        if (state.filters.inicio && state.filters.fim && state.filters.inicio > state.filters.fim) {
            showFeedback(elements.authFeedback, 'A data inicial não pode ser maior que a data final.', 'error');
            return;
        }
        showFeedback(elements.authFeedback, '', '');
        await loadLogs();
    }

    async function handleClearFilters() {
        state.filters = { busca: '', impedimento: '', inicio: '', fim: '' };
        elements.busca.value = '';
        elements.filtroImpedimento.value = '';
        elements.inicio.value = '';
        elements.fim.value = '';
        showFeedback(elements.authFeedback, '', '');
        await loadLogs();
    }

    async function handleLogSubmit(e) {
        e.preventDefault();

        const conteudo = elements.conteudo.value.trim();
        const impedimento = elements.impedimento.value;

        if (!conteudo) {
            showFeedback(elements.formFeedback, 'Descreva a atividade antes de registrar.', 'error');
            return;
        }

        elements.submitBtn.disabled = true;
        elements.submitBtn.textContent = 'Registrando...';
        showFeedback(elements.formFeedback, '', '');

        try {
            await api.post('/api/logs', { conteudo, impedimento });
            elements.logForm.reset();
            updateCharCount();
            showFeedback(elements.formFeedback, 'Atividade registrada com timestamp UTC do servidor.', 'success');
            await loadLogs();
        } catch (err) {
            console.error('Erro ao registar log:', err);
            showFeedback(elements.formFeedback, `Erro ao registrar atividade: ${err.message}`, 'error');
        } finally {
            elements.submitBtn.disabled = false;
            elements.submitBtn.textContent = 'Registrar';
        }
    }

    function renderTimeline() {
        const timeline = elements.timeline;
        timeline.textContent = '';

        if (state.logs.length === 0) {
            const hasActiveFilter = Boolean(
                state.filters.busca.trim() ||
                state.filters.impedimento ||
                state.filters.inicio ||
                state.filters.fim
            );
            renderEmptyTimeline(
                hasActiveFilter
                    ? 'Nenhum registro encontrado para os filtros aplicados.'
                    : 'Nenhum registro cadastrado ainda. Crie sua primeira entrada acima!'
            );
            return;
        }

        timeline.classList.remove('timeline-empty');
        const fragment = document.createDocumentFragment();

        state.logs.forEach((log, index) => {
            const card = createTimelineCard(log, index);
            fragment.appendChild(card);
        });

        timeline.appendChild(fragment);
    }

    function createTimelineCard(log, index) {
        const card = document.createElement('article');
        card.className = 'timeline-card';
        card.dataset.impedimento = log.impedimento;
        card.style.setProperty('--i', String(index));

        const header = document.createElement('div');
        header.className = 'card-header';

        const meta = document.createElement('div');
        meta.className = 'card-meta';

        const date = document.createElement('time');
        date.className = 'card-date';
        date.dateTime = log.criado_em;
        date.textContent = formatDate(log.criado_em);
        meta.appendChild(date);

        const author = document.createElement('div');
        author.className = 'card-author';

        const avatar = createAvatarImg(log.user_id, log.avatar, 24);
        author.appendChild(avatar);

        const name = document.createElement('span');
        name.textContent = log.username || 'Desconhecido';
        author.appendChild(name);

        meta.appendChild(author);
        header.appendChild(meta);

        const impedimentoBadge = document.createElement('span');
        impedimentoBadge.className = `card-impedimento ${log.impedimento}`;
        impedimentoBadge.textContent = getImpedimentoLabel(log.impedimento);
        header.appendChild(impedimentoBadge);

        card.appendChild(header);

        const content = document.createElement('div');
        content.className = 'card-content';
        content.textContent = log.conteudo;
        card.appendChild(content);

        return card;
    }

    function renderEmptyTimeline(message) {
        const timeline = elements.timeline;
        timeline.textContent = '';
        timeline.classList.add('timeline-empty');

        const box = document.createElement('div');
        box.className = 'card-empty';
        box.textContent = message;
        timeline.appendChild(box);
    }

    function init() {
        checkUrlAuthError();
        updateCharCount();
        elements.conteudo.addEventListener('input', updateCharCount);
        elements.logForm.addEventListener('submit', handleLogSubmit);
        elements.filtersForm.addEventListener('submit', handleFilterSubmit);
        elements.clearFilters.addEventListener('click', handleClearFilters);
        checkAuth();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
