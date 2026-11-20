let currentUser = null;
const FALLBACK_POSTER = 'https://placehold.co/400x220/1e293b/94a3b8?text=Sem+Poster';

document.addEventListener('DOMContentLoaded', async () => {
    await loadUser();
    await loadMovies();

    document.getElementById('sort-select').addEventListener('change', (e) => {
        loadMovies(e.target.value);
    });

    const newMoviePanel = document.getElementById('new-movie-panel');
    document.getElementById('btn-open-new-movie').addEventListener('click', () => {
        newMoviePanel.classList.remove('hidden');
    });
    document.getElementById('btn-cancel-movie').addEventListener('click', () => {
        newMoviePanel.classList.add('hidden');
    });

    document.getElementById('new-movie-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('movie-title').value;
        const poster_url = document.getElementById('movie-poster').value;
        const description = document.getElementById('movie-desc').value;

        const res = await fetch('/api/movies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, poster_url, description })
        });

        if (res.ok) {
            e.target.reset();
            newMoviePanel.classList.add('hidden');
            await loadMovies(document.getElementById('sort-select').value);
        } else {
            alert('Erro ao cadastrar. Verifique se está logado.');
        }
    });

    const modal = document.getElementById('review-modal');
    document.getElementById('btn-close-modal').addEventListener('click', () => modal.close());

    document.getElementById('review-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const filme_id = document.getElementById('review-movie-id').value;
        const rating = document.getElementById('review-rating').value;
        const review_text = document.getElementById('review-text').value;

        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filme_id, rating, review_text })
        });

        if (res.ok) {
            await openMovieModal(filme_id, document.getElementById('modal-movie-title').textContent, document.getElementById('modal-movie-desc').textContent);
            await loadMovies(document.getElementById('sort-select').value);
        } else {
            alert('Não foi possível salvar sua avaliação.');
        }
    });
});

async function loadUser() {
    try {
        const res = await fetch('/api/me');
        currentUser = await res.json();
    } catch {
        currentUser = null;
    }

    const authArea = document.getElementById('auth-area');
    const btnNewMovie = document.getElementById('btn-open-new-movie');

    if (currentUser && currentUser.id) {
        const avatarUrl = currentUser.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        authArea.innerHTML = `
            <div class="user-badge">
                <img src="${avatarUrl}" alt="Avatar">
                <span>${escapeHtml(currentUser.name || 'Usuário')}</span>
                <span class="user-id-tag">(${escapeHtml(currentUser.id)})</span>
            </div>
        `;
        btnNewMovie.classList.remove('hidden');
    } else {
        authArea.innerHTML = `<a href="/api/auth/login" class="btn btn-discord">Entrar com Discord</a>`;
        btnNewMovie.classList.add('hidden');
    }
}

async function loadMovies(sort = 'recent') {
    const grid = document.getElementById('movies-grid');
    try {
        const res = await fetch(`/api/movies?sort=${encodeURIComponent(sort)}`);
        const movies = await res.json();

        if (!movies.length) {
            grid.innerHTML = '<p>Nenhum filme ou série cadastrado ainda.</p>';
            return;
        }

        grid.innerHTML = '';
        movies.forEach((movie) => {
            const avg = Number(movie.avg_rating || 0).toFixed(1);
            const total = Number(movie.total_reviews || 0);
            const poster = movie.poster_url && movie.poster_url.trim() ? movie.poster_url : FALLBACK_POSTER;

            const card = document.createElement('article');
            card.className = 'movie-card';
            card.innerHTML = `
                <img class="movie-poster" src="${escapeHtml(poster)}" alt="${escapeHtml(movie.title)}" onerror="this.src='${FALLBACK_POSTER}'">
                <div class="movie-body">
                    <div>
                        <h2 class="movie-title">${escapeHtml(movie.title)}</h2>
                        <p class="movie-desc">${escapeHtml(movie.description || 'Sem descrição.')}</p>
                    </div>
                    <div>
                        <div class="movie-stats">
                            <span class="rating-badge">⭐ ${avg} (${total})</span>
                            <button class="btn btn-primary btn-sm">Avaliar / Ver</button>
                        </div>
                    </div>
                </div>
            `;
            card.querySelector('button').addEventListener('click', () => {
                openMovieModal(movie.id, movie.title, movie.description || '');
            });
            grid.appendChild(card);
        });
    } catch {
        grid.innerHTML = '<p>Erro ao carregar o catálogo.</p>';
    }
}

async function openMovieModal(movieId, title, description) {
    const modal = document.getElementById('review-modal');
    document.getElementById('modal-movie-title').textContent = title;
    document.getElementById('modal-movie-desc').textContent = description;
    document.getElementById('review-movie-id').value = movieId;

    const btnSubmit = document.getElementById('btn-submit-review');
    const loginWarning = document.getElementById('login-warning');

    if (currentUser && currentUser.id) {
        btnSubmit.disabled = false;
        loginWarning.classList.add('hidden');
    } else {
        btnSubmit.disabled = true;
        loginWarning.classList.remove('hidden');
    }

    const list = document.getElementById('reviews-list');
    list.innerHTML = '<li>Carregando avaliações...</li>';
    if (!modal.open) modal.showModal();

    const res = await fetch(`/api/reviews?filme_id=${encodeURIComponent(movieId)}`);
    const reviews = await res.json();

    list.innerHTML = '';
    if (!reviews.length) {
        list.innerHTML = '<li class="review-item">Nenhuma avaliação ainda. Seja o primeiro!</li>';
        return;
    }

    reviews.forEach((rev) => {
        if (currentUser && rev.user_id === currentUser.id) {
            document.getElementById('review-rating').value = rev.rating;
            document.getElementById('review-text').value = rev.review_text || '';
        }

        const li = document.createElement('li');
        li.className = 'review-item';
        li.innerHTML = `
            <div class="review-item-header">
                <span>Usuário: ${escapeHtml(rev.user_id)}</span>
                <span>⭐ ${rev.rating}/5</span>
            </div>
            <p>${escapeHtml(rev.review_text || '(Sem comentário)')}</p>
        `;
        list.appendChild(li);
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}