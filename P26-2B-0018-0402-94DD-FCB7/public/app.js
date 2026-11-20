(function () {
  "use strict";

  const THEME_OPTIONS = [
    "Synthwave",
    "Lo-Fi",
    "Rock Clássico",
    "Eletrônica",
    "Indie",
    "Metal",
    "Jazz",
    "Trilha Sonora",
    "Foco & Código"
  ];

  const ALLOWED_EMBED_HOSTS = new Set([
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "open.spotify.com",
    "w.soundcloud.com"
  ]);

  const AUTH_ERROR_MESSAGES = {
    oauth_not_configured: "O login com Discord ainda não está configurado no servidor (variáveis DISCORD_CLIENT_ID / SECRET ausentes).",
    access_denied: "A autorização com o Discord foi cancelada pelo usuário.",
    invalid_state: "Sessão de autenticação expirada ou inválida. Tente entrar com o Discord novamente.",
    missing_code: "O Discord não retornou o código de autorização. Tente novamente.",
    token_exchange_failed: "Não foi possível validar o token com o Discord. Tente novamente em instantes.",
    missing_access_token: "O Discord não retornou o token de acesso esperado. Tente novamente.",
    fetch_user_failed: "Não foi possível obter os dados do seu perfil Discord.",
    user_fetch_failed: "Não foi possível obter os dados do seu perfil Discord.",
    invalid_discord_profile: "O perfil retornado pelo Discord está incompleto. Tente novamente.",
    db_unavailable: "Banco de dados Cloudflare D1 indisponível no momento. Tente novamente em instantes.",
    oauth_exception: "Ocorreu um erro inesperado ao concluir o login com o Discord."
  };

  const state = {
    user: null,
    discordOAuthConfigured: true,
    d1Connected: false,
    stats: { rooms: 0, tracks: 0, votes: 0 },
    rooms: [],
    searchQuery: "",
    activeRoom: null,
    tracks: [],
    selectedGenre: "ALL",
    requestedRoomSlug: null,
    playerOpen: false,
    playingTrackId: null,
    mountedEmbedUrl: null,
    inFlightVotes: new Set(),
    roomsAbortController: null,
    roomDetailAbortController: null,
    confirmCallback: null
  };

  const dom = {
    d1StatusPill: document.getElementById("d1StatusPill"),
    d1StatusText: document.getElementById("d1StatusText"),
    authArea: document.getElementById("authArea"),

    feedbackBanner: document.getElementById("feedbackBanner"),
    feedbackMessage: document.getElementById("feedbackMessage"),
    feedbackActionSlot: document.getElementById("feedbackActionSlot"),
    feedbackCloseBtn: document.getElementById("feedbackCloseBtn"),

    roomCountBadge: document.getElementById("roomCountBadge"),
    openCreateRoomBtn: document.getElementById("openCreateRoomBtn"),
    emptyCreateRoomBtn: document.getElementById("emptyCreateRoomBtn"),
    stageCreateRoomBtn: document.getElementById("stageCreateRoomBtn"),
    roomSearchInput: document.getElementById("roomSearchInput"),
    roomList: document.getElementById("roomList"),
    roomListEmpty: document.getElementById("roomListEmpty"),
    roomListEmptyTitle: document.getElementById("roomListEmptyTitle"),
    roomListEmptyDesc: document.getElementById("roomListEmptyDesc"),

    noRoomState: document.getElementById("noRoomState"),
    roomLoadingState: document.getElementById("roomLoadingState"),
    activeRoomView: document.getElementById("activeRoomView"),

    activeRoomTheme: document.getElementById("activeRoomTheme"),
    activeRoomTrackTotal: document.getElementById("activeRoomTrackTotal"),
    activeRoomVoteTotal: document.getElementById("activeRoomVoteTotal"),
    activeRoomTitle: document.getElementById("activeRoomTitle"),
    activeRoomDesc: document.getElementById("activeRoomDesc"),
    activeRoomCreator: document.getElementById("activeRoomCreator"),
    activeRoomCreatedAt: document.getElementById("activeRoomCreatedAt"),
    copyRoomLinkBtn: document.getElementById("copyRoomLinkBtn"),
    refreshRoomBtn: document.getElementById("refreshRoomBtn"),
    deleteRoomBtn: document.getElementById("deleteRoomBtn"),

    spotlightSection: document.getElementById("spotlightSection"),
    spotlightTopBadge: document.getElementById("spotlightTopBadge"),
    spotlightNowPlayingBadge: document.getElementById("spotlightNowPlayingBadge"),
    spotlightScore: document.getElementById("spotlightScore"),
    spotlightHeading: document.getElementById("spotlightHeading"),
    spotlightArtist: document.getElementById("spotlightArtist"),
    spotlightProvider: document.getElementById("spotlightProvider"),
    spotlightGenre: document.getElementById("spotlightGenre"),
    spotlightVoteBreakdown: document.getElementById("spotlightVoteBreakdown"),
    spotlightAuthor: document.getElementById("spotlightAuthor"),
    togglePlayerBtn: document.getElementById("togglePlayerBtn"),
    returnTopTrackBtn: document.getElementById("returnTopTrackBtn"),
    spotlightExternalLink: document.getElementById("spotlightExternalLink"),
    playerEmbedContainer: document.getElementById("playerEmbedContainer"),
    playerEmbedLabel: document.getElementById("playerEmbedLabel"),
    closePlayerBtn: document.getElementById("closePlayerBtn"),
    playerIframeSlot: document.getElementById("playerIframeSlot"),

    urlProviderIndicator: document.getElementById("urlProviderIndicator"),
    submitAuthNotice: document.getElementById("submitAuthNotice"),
    submitTrackForm: document.getElementById("submitTrackForm"),
    trackUrlInput: document.getElementById("trackUrlInput"),
    trackTitleInput: document.getElementById("trackTitleInput"),
    trackArtistInput: document.getElementById("trackArtistInput"),
    trackGenreInput: document.getElementById("trackGenreInput"),
    submitTrackBtn: document.getElementById("submitTrackBtn"),

    queueCountBadge: document.getElementById("queueCountBadge"),
    genreFilterBar: document.getElementById("genreFilterBar"),
    trackList: document.getElementById("trackList"),
    trackListEmpty: document.getElementById("trackListEmpty"),
    trackListEmptyTitle: document.getElementById("trackListEmptyTitle"),
    trackListEmptyDesc: document.getElementById("trackListEmptyDesc"),

    createRoomDialog: document.getElementById("createRoomDialog"),
    createRoomForm: document.getElementById("createRoomForm"),
    closeCreateRoomDialogBtn: document.getElementById("closeCreateRoomDialogBtn"),
    cancelCreateRoomBtn: document.getElementById("cancelCreateRoomBtn"),
    confirmCreateRoomBtn: document.getElementById("confirmCreateRoomBtn"),
    roomNameInput: document.getElementById("roomNameInput"),
    roomDescInput: document.getElementById("roomDescInput"),
    roomThemeSelect: document.getElementById("roomThemeSelect"),
    themeQuickChips: document.getElementById("themeQuickChips"),
    createRoomError: document.getElementById("createRoomError"),

    confirmDialog: document.getElementById("confirmDialog"),
    confirmDialogTitle: document.getElementById("confirmDialogTitle"),
    confirmDialogMessage: document.getElementById("confirmDialogMessage"),
    closeConfirmDialogBtn: document.getElementById("closeConfirmDialogBtn"),
    cancelConfirmBtn: document.getElementById("cancelConfirmBtn"),
    acceptConfirmBtn: document.getElementById("acceptConfirmBtn")
  };

  /* ========================================================================
     Utilitários de Segurança, Formatação e DOM Seguro
     ======================================================================== */

  function isSafeHttpsUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
    try {
      const parsed = new URL(rawUrl.trim());
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function isSafeEmbedUrl(rawUrl) {
    if (!isSafeHttpsUrl(rawUrl)) return false;
    try {
      const parsed = new URL(rawUrl.trim());
      return ALLOWED_EMBED_HOSTS.has(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  const YOUTUBE_PREVIEW_HOSTS = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be"
  ]);

  const SOUNDCLOUD_PREVIEW_HOSTS = new Set([
    "soundcloud.com",
    "www.soundcloud.com",
    "m.soundcloud.com"
  ]);

  function detectProviderFromUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) {
      return { status: "idle", provider: null, label: "Aguardando link..." };
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { status: "invalid", provider: null, label: "Digite uma URL completa (https://...)" };
    }

    if (parsed.protocol !== "https:") {
      return { status: "invalid", provider: null, label: "Use apenas links seguros https://" };
    }

    const host = parsed.hostname.toLowerCase();
    if (YOUTUBE_PREVIEW_HOSTS.has(host)) {
      return { status: "youtube", provider: "youtube", label: "✓ YouTube detectado" };
    }

    if (host === "open.spotify.com") {
      return { status: "spotify", provider: "spotify", label: "✓ Spotify detectado" };
    }

    if (SOUNDCLOUD_PREVIEW_HOSTS.has(host)) {
      return { status: "soundcloud", provider: "soundcloud", label: "✓ SoundCloud detectado" };
    }

    return { status: "invalid", provider: null, label: "⚠ Use YouTube, Spotify ou SoundCloud" };
  }

  function formatProviderLabel(provider) {
    const normalized = String(provider || "").toLowerCase();
    if (normalized === "youtube") return "YouTube";
    if (normalized === "spotify") return "Spotify";
    if (normalized === "soundcloud") return "SoundCloud";
    return provider ? String(provider) : "Link";
  }

  function providerCssClass(provider) {
    const normalized = String(provider || "").toLowerCase();
    if (normalized === "youtube") return "provider-youtube";
    if (normalized === "spotify") return "provider-spotify";
    if (normalized === "soundcloud") return "provider-soundcloud";
    return "provider-other";
  }

  function formatScore(score) {
    const n = Number(score) || 0;
    if (n > 0) return "+" + n;
    return String(n);
  }

  function scoreCssClass(score) {
    const n = Number(score) || 0;
    if (n > 0) return "score-positive";
    if (n < 0) return "score-negative";
    return "score-zero";
  }

  function pluralize(count, singular, plural) {
    const n = Number(count) || 0;
    return n + " " + (n === 1 ? singular : plural);
  }

  function formatDateShort(rawDate) {
    if (!rawDate) return "";
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return String(rawDate);
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(parsed);
    } catch {
      return parsed.toISOString().slice(0, 10);
    }
  }

  function getInitials(name) {
    const clean = String(name || "?").trim();
    if (!clean) return "?";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  function createAvatarFallback(username, small) {
    const span = document.createElement("span");
    span.className = small ? "avatar avatar-sm" : "avatar";
    span.setAttribute("aria-hidden", "true");
    span.textContent = getInitials(username);
    return span;
  }

  function createAvatarElement(avatarUrl, username, small) {
    if (!isSafeHttpsUrl(avatarUrl)) {
      return createAvatarFallback(username, small);
    }
    const img = document.createElement("img");
    img.className = small ? "avatar avatar-sm" : "avatar";
    img.src = avatarUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", function () {
      const fallback = createAvatarFallback(username, small);
      if (img.parentNode) {
        img.parentNode.replaceChild(fallback, img);
      }
    });
    return img;
  }

  function createDiscordSvgIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "btn-icon");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute(
      "d",
      "M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
    );
    svg.appendChild(path);
    return svg;
  }

  function compareTracks(a, b) {
    const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const upDiff = (Number(b.upvotes) || 0) - (Number(a.upvotes) || 0);
    if (upDiff !== 0) return upDiff;
    const dateA = String(a.created_at || "");
    const dateB = String(b.created_at || "");
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function updateRoomQueryParam(slug) {
    try {
      const url = new URL(window.location.href);
      if (slug) {
        url.searchParams.set("sala", slug);
      } else {
        url.searchParams.delete("sala");
      }
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      // Ignora em contextos sem History API
    }
  }

  /* ========================================================================
     Cliente HTTP (Fetch)
     ======================================================================== */

  async function apiRequest(url, options) {
    const config = Object.assign(
      {
        credentials: "same-origin",
        headers: {}
      },
      options || {}
    );

    if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
      config.headers = Object.assign({ "Content-Type": "application/json" }, config.headers);
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || (data && data.ok === false)) {
      const message =
        (data && (data.error || data.message)) ||
        "Erro de comunicação com o servidor (HTTP " + response.status + ").";
      const err = new Error(message);
      err.status = response.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  /* ========================================================================
     Banner de Feedback Acessível (aria-live)
     ======================================================================== */

  let feedbackTimeoutId = null;

  function showFeedback(message, variant, options) {
    const opts = options || {};
    dom.feedbackBanner.className = "feedback-banner is-" + (variant || "info");
    dom.feedbackMessage.textContent = message;
    dom.feedbackActionSlot.replaceChildren();

    if (opts.includeDiscordLogin) {
      const loginLink = document.createElement("a");
      loginLink.className = "btn btn-discord btn-xs";
      loginLink.href = "/api/auth/discord";
      loginLink.textContent = "Entrar com Discord";
      dom.feedbackActionSlot.appendChild(loginLink);
    }

    dom.feedbackBanner.classList.remove("is-hidden");

    if (feedbackTimeoutId) {
      window.clearTimeout(feedbackTimeoutId);
      feedbackTimeoutId = null;
    }

    if (!opts.sticky) {
      feedbackTimeoutId = window.setTimeout(function () {
        hideFeedback();
      }, opts.duration || 6500);
    }
  }

  function hideFeedback() {
    dom.feedbackBanner.classList.add("is-hidden");
    if (feedbackTimeoutId) {
      window.clearTimeout(feedbackTimeoutId);
      feedbackTimeoutId = null;
    }
  }

  function requireAuthFeedback(actionLabel) {
    showFeedback(
      "Entre com sua conta Discord para " + actionLabel + ".",
      "warning",
      { includeDiscordLogin: true, duration: 8000 }
    );
  }

  /* ========================================================================
     Status do Cloudflare D1 & Perfil Discord
     ======================================================================== */

  function renderD1Status() {
    dom.d1StatusPill.classList.remove("status-loading", "status-ok", "status-warn", "status-error");
    if (state.d1Connected) {
      dom.d1StatusPill.classList.add("status-ok");
      dom.d1StatusText.textContent =
        "D1 Conectado · " +
        pluralize(state.stats.rooms, "sala", "salas") +
        " · " +
        pluralize(state.stats.tracks, "faixa", "faixas");
    } else {
      dom.d1StatusPill.classList.add("status-warn");
      dom.d1StatusText.textContent = "D1 indisponível";
    }
  }

  function renderAuthArea() {
    dom.authArea.replaceChildren();

    if (state.user) {
      const profile = document.createElement("div");
      profile.className = "auth-profile";

      const avatar = createAvatarElement(state.user.avatar, state.user.username, false);
      profile.appendChild(avatar);

      const userMeta = document.createElement("div");
      userMeta.className = "auth-user-meta";

      const usernameEl = document.createElement("span");
      usernameEl.className = "auth-username";
      usernameEl.textContent = state.user.username || "Usuário Discord";
      userMeta.appendChild(usernameEl);

      const userIdEl = document.createElement("span");
      userIdEl.className = "auth-userid";
      userIdEl.textContent = "ID " + String(state.user.user_id || "");
      userMeta.appendChild(userIdEl);

      profile.appendChild(userMeta);

      const logoutBtn = document.createElement("button");
      logoutBtn.type = "button";
      logoutBtn.className = "btn btn-ghost btn-xs";
      logoutBtn.textContent = "Sair";
      logoutBtn.addEventListener("click", handleLogout);
      profile.appendChild(logoutBtn);

      dom.authArea.appendChild(profile);
    } else {
      const loginLink = document.createElement("a");
      loginLink.id = "discordLoginBtn";
      loginLink.className = "btn btn-discord";
      loginLink.href = "/api/auth/discord";
      loginLink.appendChild(createDiscordSvgIcon());

      const label = document.createElement("span");
      label.textContent = "Entrar com Discord";
      loginLink.appendChild(label);

      if (!state.discordOAuthConfigured) {
        loginLink.title = "OAuth Discord aguardando configuração de credenciais no servidor";
      }

      dom.authArea.appendChild(loginLink);
    }

    updateAuthDependentUI();
  }

  function updateAuthDependentUI() {
    const isAuthenticated = Boolean(state.user);

    dom.submitAuthNotice.classList.toggle("is-hidden", isAuthenticated);
    dom.trackUrlInput.disabled = !isAuthenticated;
    dom.trackTitleInput.disabled = !isAuthenticated;
    dom.trackArtistInput.disabled = !isAuthenticated;
    dom.trackGenreInput.disabled = !isAuthenticated;
    dom.submitTrackBtn.disabled = !isAuthenticated;

    if (state.activeRoom) {
      const isRoomOwner = Boolean(
        state.user && String(state.user.user_id) === String(state.activeRoom.created_by)
      );
      dom.deleteRoomBtn.classList.toggle("is-hidden", !isRoomOwner);
    }
  }

  async function refreshStatus() {
    try {
      const data = await apiRequest("/api/status");
      state.d1Connected = Boolean(data.d1Connected);
      state.discordOAuthConfigured = Boolean(data.discordOAuthConfigured);
      if (data.stats) {
        state.stats = {
          rooms: Number(data.stats.rooms) || 0,
          tracks: Number(data.stats.tracks) || 0,
          votes: Number(data.stats.votes) || 0
        };
      }
      if (data.sessionUser && !state.user) {
        state.user = data.sessionUser;
        renderAuthArea();
      }
      renderD1Status();
    } catch {
      dom.d1StatusPill.classList.remove("status-loading", "status-ok", "status-warn");
      dom.d1StatusPill.classList.add("status-error");
      dom.d1StatusText.textContent = "Erro ao verificar API";
    }
  }

  async function loadCurrentUser() {
    try {
      const data = await apiRequest("/api/auth/me");
      state.discordOAuthConfigured = Boolean(data.discordOAuthConfigured);
      state.user = data.authenticated && data.user ? data.user : null;
    } catch {
      state.user = null;
    }
    renderAuthArea();
  }

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      state.user = null;
      renderAuthArea();
      showFeedback("Sessão Discord encerrada.", "info");
      if (state.activeRoom) {
        await loadRoomDetail(state.activeRoom.id, { preservePlayer: true });
      }
    } catch (err) {
      showFeedback(err.message || "Não foi possível encerrar a sessão.", "error");
    }
  }

  /* ========================================================================
     Sidebar: Lista e Busca de Salas Temáticas
     ======================================================================== */

  async function loadRooms(query, options) {
    const opts = options || {};
    if (state.roomsAbortController) {
      state.roomsAbortController.abort();
    }
    state.roomsAbortController = new AbortController();

    const search = typeof query === "string" ? query : state.searchQuery;
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("q", search.trim());
    }
    const endpoint = "/api/rooms" + (params.toString() ? "?" + params.toString() : "");

    try {
      const data = await apiRequest(endpoint, { signal: state.roomsAbortController.signal });
      state.rooms = Array.isArray(data.rooms) ? data.rooms : [];
      renderRoomList();

      if (opts.selectRoomId) {
        const target = state.rooms.find(function (r) {
          return String(r.id) === String(opts.selectRoomId);
        });
        if (target) {
          await selectRoom(target);
          return;
        }
      }

      if (opts.autoSelect) {
        if (state.rooms.length === 0) {
          clearActiveRoomView();
          return;
        }

        let targetRoom = null;
        if (state.requestedRoomSlug) {
          targetRoom = state.rooms.find(function (r) {
            return r.slug === state.requestedRoomSlug || String(r.id) === state.requestedRoomSlug;
          });
          state.requestedRoomSlug = null;
        }
        if (!targetRoom && state.activeRoom) {
          targetRoom = state.rooms.find(function (r) {
            return String(r.id) === String(state.activeRoom.id);
          });
        }
        if (!targetRoom) {
          targetRoom = state.rooms[0];
        }
        await selectRoom(targetRoom);
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      dom.roomList.replaceChildren();
      showFeedback(err.message || "Falha ao carregar as salas.", "error");
    }
  }

  function renderRoomList() {
    dom.roomCountBadge.textContent = String(state.rooms.length);
    dom.roomList.replaceChildren();

    if (state.rooms.length === 0) {
      dom.roomListEmpty.classList.remove("is-hidden");
      if (state.searchQuery.trim()) {
        dom.roomListEmptyTitle.textContent = "Nenhuma sala corresponde à busca";
        dom.roomListEmptyDesc.textContent = "Tente outro termo ou crie uma nova sala com este tema.";
      } else {
        dom.roomListEmptyTitle.textContent = "Nenhuma sala criada ainda";
        dom.roomListEmptyDesc.textContent = "Crie a primeira sala temática para iniciar a playlist colaborativa.";
      }
      return;
    }

    dom.roomListEmpty.classList.add("is-hidden");
    const activeId = state.activeRoom ? String(state.activeRoom.id) : null;

    state.rooms.forEach(function (room) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "room-item";
      btn.dataset.roomId = String(room.id);
      const isSelected = activeId !== null && String(room.id) === activeId;
      if (isSelected) {
        btn.classList.add("is-selected");
        btn.setAttribute("aria-current", "true");
      }

      const topRow = document.createElement("div");
      topRow.className = "room-item-top";

      const nameEl = document.createElement("span");
      nameEl.className = "room-item-name";
      nameEl.textContent = room.name || "Sala sem nome";
      topRow.appendChild(nameEl);

      if (room.theme_tag) {
        const tagEl = document.createElement("span");
        tagEl.className = "room-item-tag";
        tagEl.textContent = room.theme_tag;
        topRow.appendChild(tagEl);
      }
      btn.appendChild(topRow);

      const statsRow = document.createElement("div");
      statsRow.className = "room-item-stats";

      const tracksSpan = document.createElement("span");
      tracksSpan.textContent = pluralize(room.track_count, "faixa", "faixas");
      statsRow.appendChild(tracksSpan);

      const dotSpan = document.createElement("span");
      dotSpan.setAttribute("aria-hidden", "true");
      dotSpan.textContent = "·";
      statsRow.appendChild(dotSpan);

      const votesSpan = document.createElement("span");
      votesSpan.textContent = pluralize(room.total_votes, "voto", "votos");
      statsRow.appendChild(votesSpan);

      btn.appendChild(statsRow);

      if (room.top_track_title) {
        const topTrackEl = document.createElement("div");
        topTrackEl.className = "room-item-top-track";
        topTrackEl.textContent = "★ #1 " + room.top_track_title;
        btn.appendChild(topTrackEl);
      }

      btn.addEventListener("click", function () {
        selectRoom(room);
      });

      dom.roomList.appendChild(btn);
    });
  }

  function syncSidebarActiveRoomSummary() {
    if (!state.activeRoom) return;
    const roomInList = state.rooms.find(function (r) {
      return String(r.id) === String(state.activeRoom.id);
    });
    if (!roomInList) return;

    const totalVotes = state.tracks.reduce(function (acc, t) {
      return acc + (Number(t.upvotes) || 0) + (Number(t.downvotes) || 0);
    }, 0);

    roomInList.track_count = state.tracks.length;
    roomInList.total_votes = totalVotes;
    roomInList.top_track_title = state.tracks.length > 0 ? state.tracks[0].title : null;

    renderRoomList();
    dom.activeRoomTrackTotal.textContent = pluralize(state.tracks.length, "faixa", "faixas");
    dom.activeRoomVoteTotal.textContent = pluralize(totalVotes, "voto", "votos");
  }

  function clearActiveRoomView() {
    state.activeRoom = null;
    state.tracks = [];
    state.selectedGenre = "ALL";
    closePlayerEmbed();
    updateRoomQueryParam(null);
    dom.roomLoadingState.classList.add("is-hidden");
    dom.activeRoomView.classList.add("is-hidden");
    dom.noRoomState.classList.remove("is-hidden");
  }

  async function selectRoom(room) {
    if (!room) return;
    const changingRoom = !state.activeRoom || String(state.activeRoom.id) !== String(room.id);

    state.activeRoom = room;
    if (changingRoom) {
      state.selectedGenre = "ALL";
      closePlayerEmbed();
    }

    updateRoomQueryParam(room.slug || String(room.id));
    renderRoomList();
    await loadRoomDetail(room.id, { preservePlayer: !changingRoom });
  }

  async function loadRoomDetail(roomId, options) {
    const opts = options || {};
    if (state.roomDetailAbortController) {
      state.roomDetailAbortController.abort();
    }
    state.roomDetailAbortController = new AbortController();

    dom.noRoomState.classList.add("is-hidden");
    if (!opts.silent) {
      dom.activeRoomView.classList.add("is-hidden");
      dom.roomLoadingState.classList.remove("is-hidden");
    }

    try {
      const data = await apiRequest("/api/rooms/" + encodeURIComponent(roomId), {
        signal: state.roomDetailAbortController.signal
      });

      state.activeRoom = data.room;
      state.tracks = Array.isArray(data.tracks) ? data.tracks.slice().sort(compareTracks) : [];

      if (!opts.preservePlayer) {
        closePlayerEmbed();
      } else if (state.playingTrackId) {
        const stillExists = state.tracks.some(function (t) {
          return String(t.id) === String(state.playingTrackId);
        });
        if (!stillExists) {
          closePlayerEmbed();
        }
      }

      updateRoomQueryParam(state.activeRoom.slug || String(state.activeRoom.id));
      renderActiveRoomHeader();
      renderGenreFilters();
      syncTrackListDomWithFlip(null, { animate: false });
      renderSpotlight();
      syncSidebarActiveRoomSummary();

      dom.roomLoadingState.classList.add("is-hidden");
      dom.activeRoomView.classList.remove("is-hidden");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      dom.roomLoadingState.classList.add("is-hidden");
      showFeedback(err.message || "Erro ao carregar detalhes da sala.", "error");
    }
  }

  function renderActiveRoomHeader() {
    const room = state.activeRoom;
    if (!room) return;

    dom.activeRoomTheme.textContent = room.theme_tag || "Playlist";
    dom.activeRoomTitle.textContent = room.name || "Sala sem nome";
    dom.activeRoomDesc.textContent =
      room.description && room.description.trim()
        ? room.description
        : "Sala colaborativa aberta para sugestões de faixas e votação da turma.";

    const totalVotes = state.tracks.reduce(function (acc, t) {
      return acc + (Number(t.upvotes) || 0) + (Number(t.downvotes) || 0);
    }, 0);
    dom.activeRoomTrackTotal.textContent = pluralize(state.tracks.length, "faixa", "faixas");
    dom.activeRoomVoteTotal.textContent = pluralize(totalVotes, "voto", "votos");

    dom.activeRoomCreator.replaceChildren();
    const creatorName = room.creator_username || "Comunidade";
    dom.activeRoomCreator.appendChild(createAvatarElement(room.creator_avatar, creatorName, true));

    const labelSpan = document.createElement("span");
    labelSpan.textContent = "Criada por ";
    const strongName = document.createElement("strong");
    strongName.textContent = creatorName;
    labelSpan.appendChild(strongName);
    dom.activeRoomCreator.appendChild(labelSpan);

    dom.activeRoomCreatedAt.textContent = room.created_at
      ? "Criada em " + formatDateShort(room.created_at)
      : "";

    updateAuthDependentUI();
  }

  /* ========================================================================
     Card #1 Mais Aprovada + Player Embarcado Sob Demanda
     ======================================================================== */

  function getSpotlightTrack() {
    if (state.tracks.length === 0) return null;
    if (state.playingTrackId) {
      const selected = state.tracks.find(function (t) {
        return String(t.id) === String(state.playingTrackId);
      });
      if (selected) return selected;
    }
    return state.tracks[0];
  }

  function renderSpotlight() {
    if (state.tracks.length === 0) {
      dom.spotlightSection.classList.add("is-hidden");
      closePlayerEmbed();
      return;
    }

    dom.spotlightSection.classList.remove("is-hidden");
    const topTrack = state.tracks[0];
    const displayTrack = getSpotlightTrack() || topTrack;
    const isTopTrack = String(displayTrack.id) === String(topTrack.id);
    const displayRank =
      state.tracks.findIndex(function (t) {
        return String(t.id) === String(displayTrack.id);
      }) + 1;

    if (!isTopTrack && state.playerOpen) {
      dom.spotlightTopBadge.textContent = "★ #1 Mais Aprovada: " + (topTrack.title || "Faixa #1");
      dom.spotlightNowPlayingBadge.textContent = "No player: #" + displayRank + " da fila";
      dom.spotlightNowPlayingBadge.classList.remove("is-hidden");
      dom.returnTopTrackBtn.classList.remove("is-hidden");
    } else {
      dom.spotlightTopBadge.textContent = "★ #1 Mais Aprovada pelo Grupo";
      dom.spotlightNowPlayingBadge.classList.add("is-hidden");
      dom.returnTopTrackBtn.classList.add("is-hidden");
    }

    dom.spotlightScore.textContent = formatScore(displayTrack.score);
    dom.spotlightScore.className = "score-pill " + scoreCssClass(displayTrack.score);

    dom.spotlightHeading.textContent = displayTrack.title || "Faixa sem título";
    dom.spotlightArtist.textContent = displayTrack.artist
      ? displayTrack.artist
      : "Artista não informado";

    dom.spotlightProvider.textContent = formatProviderLabel(displayTrack.provider);
    dom.spotlightProvider.className = "provider-pill " + providerCssClass(displayTrack.provider);

    dom.spotlightGenre.textContent = displayTrack.genre || "Geral";
    dom.spotlightVoteBreakdown.textContent =
      "▲ " + (Number(displayTrack.upvotes) || 0) + " · ▼ " + (Number(displayTrack.downvotes) || 0);

    dom.spotlightAuthor.replaceChildren();
    const authorName = displayTrack.author_username || "Anônimo";
    dom.spotlightAuthor.appendChild(createAvatarElement(displayTrack.author_avatar, authorName, true));
    const authorText = document.createElement("span");
    authorText.textContent = "Sugerida por " + authorName;
    dom.spotlightAuthor.appendChild(authorText);

    const safeHref = isSafeHttpsUrl(displayTrack.normalized_url)
      ? displayTrack.normalized_url
      : isSafeHttpsUrl(displayTrack.url)
        ? displayTrack.url
        : null;

    if (safeHref) {
      dom.spotlightExternalLink.href = safeHref;
      dom.spotlightExternalLink.classList.remove("is-hidden");
    } else {
      dom.spotlightExternalLink.removeAttribute("href");
      dom.spotlightExternalLink.classList.add("is-hidden");
    }

    dom.togglePlayerBtn.textContent = state.playerOpen ? "⏸ Ocultar player" : "▶ Ouvir no player";
    dom.togglePlayerBtn.setAttribute("aria-expanded", state.playerOpen ? "true" : "false");

    if (state.playerOpen) {
      mountPlayerEmbed(displayTrack);
    } else {
      dom.playerEmbedContainer.classList.add("is-hidden");
    }
  }

  function mountPlayerEmbed(track) {
    dom.playerEmbedContainer.classList.remove("is-hidden");
    dom.playerEmbedLabel.textContent =
      "Player " +
      formatProviderLabel(track.provider) +
      " · " +
      (track.title || "Faixa") +
      (track.artist ? " — " + track.artist : "");

    const embedUrl = track.embed_url;
    if (state.mountedEmbedUrl === embedUrl && dom.playerIframeSlot.childElementCount > 0) {
      return;
    }

    dom.playerIframeSlot.replaceChildren();
    dom.playerIframeSlot.className = "player-iframe-slot " + providerCssClass(track.provider);

    if (!isSafeEmbedUrl(embedUrl)) {
      state.mountedEmbedUrl = null;
      const fallback = document.createElement("p");
      fallback.className = "player-fallback-msg";
      fallback.textContent =
        "Player embarcado indisponível para este link. Use o botão \"Abrir link ↗\" para ouvir diretamente no provedor.";
      dom.playerIframeSlot.appendChild(fallback);
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = "Player de " + (track.title || "faixa musical");
    iframe.loading = "lazy";
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;

    dom.playerIframeSlot.appendChild(iframe);
    state.mountedEmbedUrl = embedUrl;
  }

  function closePlayerEmbed() {
    state.playerOpen = false;
    state.playingTrackId = null;
    state.mountedEmbedUrl = null;
    dom.playerEmbedContainer.classList.add("is-hidden");
    dom.playerIframeSlot.replaceChildren();
    dom.togglePlayerBtn.textContent = "▶ Ouvir no player";
    dom.togglePlayerBtn.setAttribute("aria-expanded", "false");
    updatePlayingTrackButtons();
  }

  function openTrackInPlayer(trackId) {
    state.playingTrackId = trackId;
    state.playerOpen = true;
    renderSpotlight();
    updatePlayingTrackButtons();
    if (dom.spotlightSection && typeof dom.spotlightSection.scrollIntoView === "function") {
      const rect = dom.spotlightSection.getBoundingClientRect();
      if (rect.top < 60 || rect.top > window.innerHeight * 0.7) {
        dom.spotlightSection.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "nearest"
        });
      }
    }
  }

  function updatePlayingTrackButtons() {
    const activePlayId = state.playerOpen
      ? String(state.playingTrackId || (state.tracks[0] ? state.tracks[0].id : ""))
      : null;

    const cards = dom.trackList.querySelectorAll("li.track-card");
    cards.forEach(function (card) {
      const isPlaying = activePlayId !== null && card.dataset.trackId === activePlayId;
      card.classList.toggle("is-playing", isPlaying);
      const listenBtn = card.querySelector("[data-role='listen-btn']");
      if (listenBtn) {
        listenBtn.textContent = isPlaying ? "Tocando" : "Ouvir";
        listenBtn.classList.toggle("btn-play-active", isPlaying);
        listenBtn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      }
    });
  }

  /* ========================================================================
     Filtro por Gênero Musical
     ======================================================================== */

  function renderGenreFilters() {
    dom.genreFilterBar.replaceChildren();
    if (state.tracks.length === 0) return;

    const counts = new Map();
    state.tracks.forEach(function (track) {
      const genre = (track.genre || "Geral").trim() || "Geral";
      counts.set(genre, (counts.get(genre) || 0) + 1);
    });

    if (state.selectedGenre !== "ALL" && !counts.has(state.selectedGenre)) {
      state.selectedGenre = "ALL";
    }

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-chip" + (state.selectedGenre === "ALL" ? " is-active" : "");
    allBtn.setAttribute("aria-pressed", state.selectedGenre === "ALL" ? "true" : "false");
    allBtn.textContent = "Todos (" + state.tracks.length + ")";
    allBtn.addEventListener("click", function () {
      state.selectedGenre = "ALL";
      renderGenreFilters();
      syncTrackListDomWithFlip(null, { animate: true });
    });
    dom.genreFilterBar.appendChild(allBtn);

    const sortedGenres = Array.from(counts.keys()).sort(function (a, b) {
      return a.localeCompare(b, "pt-BR");
    });

    sortedGenres.forEach(function (genre) {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = state.selectedGenre === genre;
      btn.className = "filter-chip" + (isActive ? " is-active" : "");
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.textContent = genre + " (" + counts.get(genre) + ")";
      btn.addEventListener("click", function () {
        state.selectedGenre = genre;
        renderGenreFilters();
        syncTrackListDomWithFlip(null, { animate: true });
      });
      dom.genreFilterBar.appendChild(btn);
    });
  }

  function getFilteredTracks() {
    if (state.selectedGenre === "ALL") return state.tracks;
    return state.tracks.filter(function (track) {
      const genre = (track.genre || "Geral").trim() || "Geral";
      return genre === state.selectedGenre;
    });
  }

  /* ========================================================================
     Fila Colaborativa + Reordenação Dinâmica FLIP (Vanilla JS)
     ======================================================================== */

  function canDeleteTrack(track) {
    if (!state.user) return false;
    const uid = String(state.user.user_id);
    if (String(track.submitted_by) === uid) return true;
    if (state.activeRoom && String(state.activeRoom.created_by) === uid) return true;
    return false;
  }

  function createTrackCardElement(track) {
    const li = document.createElement("li");
    li.className = "track-card";
    li.dataset.trackId = String(track.id);

    // 1. Posição no ranking
    const rankBadge = document.createElement("div");
    rankBadge.className = "rank-badge";
    rankBadge.dataset.role = "rank-badge";
    li.appendChild(rankBadge);

    // 2. Controles de voto (▲ / saldo / ▼)
    const voteCol = document.createElement("div");
    voteCol.className = "vote-column";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "vote-btn vote-btn-up";
    upBtn.dataset.role = "vote-up";
    upBtn.textContent = "▲";
    upBtn.addEventListener("click", function () {
      handleVote(track.id, 1);
    });
    voteCol.appendChild(upBtn);

    const scoreEl = document.createElement("span");
    scoreEl.className = "vote-score";
    scoreEl.dataset.role = "vote-score";
    voteCol.appendChild(scoreEl);

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "vote-btn vote-btn-down";
    downBtn.dataset.role = "vote-down";
    downBtn.textContent = "▼";
    downBtn.addEventListener("click", function () {
      handleVote(track.id, -1);
    });
    voteCol.appendChild(downBtn);

    li.appendChild(voteCol);

    // 3. Informações da faixa
    const main = document.createElement("div");
    main.className = "track-main";

    const titleRow = document.createElement("div");
    titleRow.className = "track-title-row";

    const titleEl = document.createElement("span");
    titleEl.className = "track-title";
    titleEl.dataset.role = "track-title";
    titleRow.appendChild(titleEl);

    const artistEl = document.createElement("span");
    artistEl.className = "track-artist";
    artistEl.dataset.role = "track-artist";
    titleRow.appendChild(artistEl);

    main.appendChild(titleRow);

    const metaRow = document.createElement("div");
    metaRow.className = "track-meta-row";

    const genrePill = document.createElement("span");
    genrePill.className = "genre-pill";
    genrePill.dataset.role = "genre-pill";
    metaRow.appendChild(genrePill);

    const providerPill = document.createElement("span");
    providerPill.className = "provider-pill";
    providerPill.dataset.role = "provider-pill";
    metaRow.appendChild(providerPill);

    const breakdownEl = document.createElement("span");
    breakdownEl.className = "vote-breakdown";
    breakdownEl.dataset.role = "vote-breakdown";
    metaRow.appendChild(breakdownEl);

    const authorWrap = document.createElement("span");
    authorWrap.className = "user-inline user-inline-compact";
    authorWrap.dataset.role = "author-wrap";
    metaRow.appendChild(authorWrap);

    main.appendChild(metaRow);
    li.appendChild(main);

    // 4. Botões de ação
    const actions = document.createElement("div");
    actions.className = "track-actions";

    const listenBtn = document.createElement("button");
    listenBtn.type = "button";
    listenBtn.className = "btn btn-secondary btn-xs";
    listenBtn.dataset.role = "listen-btn";
    listenBtn.textContent = "Ouvir";
    listenBtn.addEventListener("click", function () {
      openTrackInPlayer(track.id);
    });
    actions.appendChild(listenBtn);

    const openLink = document.createElement("a");
    openLink.className = "btn btn-ghost btn-xs";
    openLink.dataset.role = "open-link";
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "Abrir ↗";
    actions.appendChild(openLink);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-danger-outline btn-xs";
    removeBtn.dataset.role = "remove-btn";
    removeBtn.textContent = "Remover";
    removeBtn.addEventListener("click", function () {
      confirmDeleteTrack(track);
    });
    actions.appendChild(removeBtn);

    li.appendChild(actions);
    return li;
  }

  function updateTrackCardElement(li, track, rank) {
    li.dataset.rank = String(rank);

    const rankBadge = li.querySelector("[data-role='rank-badge']");
    rankBadge.textContent = "#" + rank;
    rankBadge.className = "rank-badge" + (rank <= 3 ? " rank-" + rank : "");
    rankBadge.setAttribute("aria-label", "Posição " + rank + " na sala");

    const userVote = Number(track.user_vote) || 0;
    const isPending = state.inFlightVotes.has(String(track.id));

    const upBtn = li.querySelector("[data-role='vote-up']");
    upBtn.classList.toggle("is-active", userVote === 1);
    upBtn.setAttribute("aria-pressed", userVote === 1 ? "true" : "false");
    upBtn.setAttribute("aria-label", "Aprovar faixa " + (track.title || ""));
    upBtn.disabled = isPending;

    const downBtn = li.querySelector("[data-role='vote-down']");
    downBtn.classList.toggle("is-active", userVote === -1);
    downBtn.setAttribute("aria-pressed", userVote === -1 ? "true" : "false");
    downBtn.setAttribute("aria-label", "Reprovar faixa " + (track.title || ""));
    downBtn.disabled = isPending;

    const scoreEl = li.querySelector("[data-role='vote-score']");
    scoreEl.textContent = formatScore(track.score);
    scoreEl.className = "vote-score " + scoreCssClass(track.score);

    const titleEl = li.querySelector("[data-role='track-title']");
    titleEl.textContent = track.title || "Faixa sem título";

    const artistEl = li.querySelector("[data-role='track-artist']");
    if (track.artist && track.artist.trim()) {
      artistEl.textContent = "· " + track.artist.trim();
      artistEl.classList.remove("is-hidden");
    } else {
      artistEl.textContent = "";
      artistEl.classList.add("is-hidden");
    }

    const genrePill = li.querySelector("[data-role='genre-pill']");
    genrePill.textContent = track.genre || "Geral";

    const providerPill = li.querySelector("[data-role='provider-pill']");
    providerPill.textContent = formatProviderLabel(track.provider);
    providerPill.className = "provider-pill " + providerCssClass(track.provider);

    const breakdownEl = li.querySelector("[data-role='vote-breakdown']");
    breakdownEl.textContent =
      "▲ " + (Number(track.upvotes) || 0) + " · ▼ " + (Number(track.downvotes) || 0);

    const authorWrap = li.querySelector("[data-role='author-wrap']");
    const authorSignature = (track.author_username || "") + "|" + (track.author_avatar || "");
    if (authorWrap.dataset.sig !== authorSignature) {
      authorWrap.dataset.sig = authorSignature;
      authorWrap.replaceChildren();
      const authorName = track.author_username || "Anônimo";
      authorWrap.appendChild(createAvatarElement(track.author_avatar, authorName, true));
      const authorSpan = document.createElement("span");
      authorSpan.textContent = authorName;
      authorWrap.appendChild(authorSpan);
    }

    const openLink = li.querySelector("[data-role='open-link']");
    const safeUrl = isSafeHttpsUrl(track.normalized_url)
      ? track.normalized_url
      : isSafeHttpsUrl(track.url)
        ? track.url
        : null;
    if (safeUrl) {
      openLink.href = safeUrl;
      openLink.classList.remove("is-hidden");
    } else {
      openLink.removeAttribute("href");
      openLink.classList.add("is-hidden");
    }

    const removeBtn = li.querySelector("[data-role='remove-btn']");
    removeBtn.classList.toggle("is-hidden", !canDeleteTrack(track));
  }

  function syncTrackListDomWithFlip(votedTrackId, options) {
    const opts = options || {};
    const shouldAnimate = opts.animate !== false && !prefersReducedMotion();

    // 1. FIRST: captura posições atuais e mapeia nós existentes antes da reordenação
    const existingNodes = new Map();
    const firstTops = new Map();
    const currentChildren = Array.from(dom.trackList.children);

    currentChildren.forEach(function (node) {
      const id = node.dataset.trackId;
      if (!id) return;
      existingNodes.set(id, node);
      if (shouldAnimate) {
        firstTops.set(id, node.getBoundingClientRect().top);
      }
    });

    // 2. Ordena estado oficial por score DESC, upvotes DESC, created_at ASC, id ASC
    state.tracks.sort(compareTracks);

    const globalRankMap = new Map();
    state.tracks.forEach(function (track, idx) {
      globalRankMap.set(String(track.id), idx + 1);
    });

    const visibleTracks = getFilteredTracks();
    dom.queueCountBadge.textContent = String(visibleTracks.length);

    if (visibleTracks.length === 0) {
      dom.trackList.replaceChildren();
      dom.trackListEmpty.classList.remove("is-hidden");
      if (state.tracks.length > 0 && state.selectedGenre !== "ALL") {
        dom.trackListEmptyTitle.textContent = "Nenhuma faixa no gênero " + state.selectedGenre;
        dom.trackListEmptyDesc.textContent = "Selecione \"Todos\" para ver todas as faixas da sala.";
      } else {
        dom.trackListEmptyTitle.textContent = "Esta sala ainda não tem faixas";
        dom.trackListEmptyDesc.textContent = "Adicione o primeiro link acima para inaugurar a votação colaborativa.";
      }
      return;
    }

    dom.trackListEmpty.classList.add("is-hidden");

    // 3. Reordena nós sem destruir os elementos existentes (DOM reuse)
    const visibleIdSet = new Set();
    visibleTracks.forEach(function (track) {
      const id = String(track.id);
      visibleIdSet.add(id);
      let li = existingNodes.get(id);
      if (!li) {
        li = createTrackCardElement(track);
      }
      updateTrackCardElement(li, track, globalRankMap.get(id) || 1);
      dom.trackList.appendChild(li);
    });

    existingNodes.forEach(function (node, id) {
      if (!visibleIdSet.has(id) && node.parentNode === dom.trackList) {
        dom.trackList.removeChild(node);
      }
    });

    updatePlayingTrackButtons();

    // 4. LAST + INVERT + PLAY (FLIP)
    if (shouldAnimate && firstTops.size > 0) {
      const movedNodes = [];

      Array.from(dom.trackList.children).forEach(function (li) {
        const id = li.dataset.trackId;
        if (!firstTops.has(id)) return;
        const oldTop = firstTops.get(id);
        const newTop = li.getBoundingClientRect().top;
        const deltaY = oldTop - newTop;

        if (Math.abs(deltaY) > 0.5) {
          li.style.transition = "none";
          li.style.transform = "translateY(" + deltaY + "px)";
          li.classList.remove("is-moved-up", "is-moved-down");
          li.classList.add(deltaY > 0 ? "is-moved-up" : "is-moved-down");
          movedNodes.push(li);
        }
      });

      if (movedNodes.length > 0) {
        // Força reflow para registrar o estado invertido antes da transição
        void dom.trackList.offsetHeight;

        window.requestAnimationFrame(function () {
          movedNodes.forEach(function (li) {
            li.style.transition = "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)";
            li.style.transform = "";

            const cleanup = function () {
              li.style.transition = "";
              li.removeEventListener("transitionend", cleanup);
            };
            li.addEventListener("transitionend", cleanup);

            window.setTimeout(function () {
              li.style.transition = "";
              li.classList.remove("is-moved-up", "is-moved-down");
            }, 650);
          });
        });
      }
    }

    if (votedTrackId !== null && votedTrackId !== undefined) {
      const targetId = String(votedTrackId);
      const votedEl = Array.from(dom.trackList.children).find(function (node) {
        return node.dataset.trackId === targetId;
      });
      if (votedEl) {
        votedEl.classList.remove("is-vote-flash");
        void votedEl.offsetWidth;
        votedEl.classList.add("is-vote-flash");
        window.setTimeout(function () {
          votedEl.classList.remove("is-vote-flash");
        }, 700);
      }
    }
  }

  /* ========================================================================
     Ações de Voto, Criação de Sala, Submissão e Exclusão
     ======================================================================== */

  async function handleVote(trackId, direction) {
    if (!state.user) {
      requireAuthFeedback("votar nas faixas da playlist");
      return;
    }

    const key = String(trackId);
    if (state.inFlightVotes.has(key)) return;

    const track = state.tracks.find(function (t) {
      return String(t.id) === key;
    });
    if (!track) return;

    const currentVote = Number(track.user_vote) || 0;
    const nextValue = currentVote === direction ? 0 : direction;

    state.inFlightVotes.add(key);
    syncTrackListDomWithFlip(null, { animate: false });

    try {
      const result = await apiRequest("/api/tracks/" + encodeURIComponent(trackId) + "/vote", {
        method: "POST",
        body: { value: nextValue }
      });

      track.score = Number(result.score) || 0;
      track.upvotes = Number(result.upvotes) || 0;
      track.downvotes = Number(result.downvotes) || 0;
      track.user_vote = Number(result.user_vote) || 0;

      state.inFlightVotes.delete(key);
      syncTrackListDomWithFlip(track.id, { animate: true });
      renderSpotlight();
      syncSidebarActiveRoomSummary();
      refreshStatus();
    } catch (err) {
      state.inFlightVotes.delete(key);
      syncTrackListDomWithFlip(null, { animate: false });
      if (err && err.status === 401) {
        state.user = null;
        renderAuthArea();
        requireAuthFeedback("votar nas faixas");
      } else {
        showFeedback(err.message || "Não foi possível registrar seu voto.", "error");
      }
    }
  }

  async function handleSubmitTrack(event) {
    event.preventDefault();
    if (!state.user) {
      requireAuthFeedback("sugerir novas faixas");
      return;
    }
    if (!state.activeRoom) return;

    const url = dom.trackUrlInput.value.trim();
    const title = dom.trackTitleInput.value.trim();
    const artist = dom.trackArtistInput.value.trim();
    const genre = dom.trackGenreInput.value.trim() || "Geral";

    const detected = detectProviderFromUrl(url);
    if (!url || !detected.provider) {
      showFeedback("Informe um link válido do YouTube, Spotify ou SoundCloud.", "warning");
      dom.trackUrlInput.focus();
      return;
    }

    if (!title) {
      showFeedback("Informe o título da faixa antes de adicionar à fila.", "warning");
      dom.trackTitleInput.focus();
      return;
    }

    dom.submitTrackBtn.disabled = true;
    dom.submitTrackBtn.textContent = "Adicionando...";

    try {
      const data = await apiRequest(
        "/api/rooms/" + encodeURIComponent(state.activeRoom.id) + "/tracks",
        {
          method: "POST",
          body: { title: title, artist: artist, genre: genre, url: url }
        }
      );

      if (data.track) {
        const addedTrack = Object.assign(
          { score: 0, upvotes: 0, downvotes: 0, user_vote: 0 },
          data.track
        );
        state.tracks.push(addedTrack);
        state.selectedGenre = "ALL";
        renderGenreFilters();
        syncTrackListDomWithFlip(addedTrack.id, { animate: true });
        renderSpotlight();
        syncSidebarActiveRoomSummary();
      } else {
        await loadRoomDetail(state.activeRoom.id, { preservePlayer: true, silent: true });
      }

      dom.submitTrackForm.reset();
      updateUrlProviderIndicator("");
      showFeedback("Faixa \"" + title + "\" adicionada à fila colaborativa!", "success");
      refreshStatus();
    } catch (err) {
      if (err && err.status === 401) {
        state.user = null;
        renderAuthArea();
        requireAuthFeedback("sugerir novas faixas");
      } else {
        showFeedback(err.message || "Não foi possível adicionar a faixa.", "error");
      }
    } finally {
      dom.submitTrackBtn.disabled = !state.user;
      dom.submitTrackBtn.textContent = "+ Adicionar à Fila";
    }
  }

  function openCreateRoomDialog() {
    if (!state.user) {
      requireAuthFeedback("criar uma nova sala temática");
      return;
    }
    dom.createRoomForm.reset();
    dom.roomThemeSelect.value = THEME_OPTIONS[0];
    syncThemeQuickChips();
    dom.createRoomError.textContent = "";
    dom.createRoomError.classList.add("is-hidden");
    dom.createRoomDialog.showModal();
    dom.roomNameInput.focus();
  }

  async function handleCreateRoom(event) {
    event.preventDefault();
    if (!state.user) {
      dom.createRoomDialog.close();
      requireAuthFeedback("criar uma nova sala temática");
      return;
    }

    const name = dom.roomNameInput.value.trim();
    const description = dom.roomDescInput.value.trim();
    const themeTag = dom.roomThemeSelect.value.trim() || "Synthwave";

    if (name.length < 3 || name.length > 60) {
      dom.createRoomError.textContent = "Informe um nome entre 3 e 60 caracteres.";
      dom.createRoomError.classList.remove("is-hidden");
      dom.roomNameInput.focus();
      return;
    }

    dom.createRoomError.classList.add("is-hidden");
    dom.confirmCreateRoomBtn.disabled = true;
    dom.confirmCreateRoomBtn.textContent = "Criando...";

    try {
      const data = await apiRequest("/api/rooms", {
        method: "POST",
        body: { name: name, description: description, theme_tag: themeTag }
      });

      dom.createRoomDialog.close();
      state.searchQuery = "";
      dom.roomSearchInput.value = "";
      showFeedback("Sala \"" + name + "\" criada com sucesso!", "success");

      const createdId = data && data.room ? data.room.id : null;
      await loadRooms("", { selectRoomId: createdId, autoSelect: true });
      refreshStatus();
    } catch (err) {
      dom.createRoomError.textContent = err.message || "Erro ao criar sala.";
      dom.createRoomError.classList.remove("is-hidden");
    } finally {
      dom.confirmCreateRoomBtn.disabled = false;
      dom.confirmCreateRoomBtn.textContent = "Criar Sala";
    }
  }

  function openConfirmDialog(title, message, onAccept) {
    dom.confirmDialogTitle.textContent = title;
    dom.confirmDialogMessage.textContent = message;
    state.confirmCallback = onAccept;
    dom.confirmDialog.showModal();
  }

  function confirmDeleteRoom() {
    if (!state.activeRoom) return;
    const room = state.activeRoom;
    openConfirmDialog(
      "Excluir sala temática",
      "Tem certeza que deseja excluir a sala \"" +
        room.name +
        "\"? Todas as faixas e votos desta sala serão removidos permanentemente.",
      async function () {
        try {
          await apiRequest("/api/rooms/" + encodeURIComponent(room.id), { method: "DELETE" });
          showFeedback("Sala \"" + room.name + "\" excluída.", "info");
          state.activeRoom = null;
          await loadRooms(state.searchQuery, { autoSelect: true });
          refreshStatus();
        } catch (err) {
          showFeedback(err.message || "Não foi possível excluir a sala.", "error");
        }
      }
    );
  }

  function confirmDeleteTrack(track) {
    openConfirmDialog(
      "Remover faixa da fila",
      "Deseja remover \"" + (track.title || "esta faixa") + "\" da fila colaborativa?",
      async function () {
        try {
          await apiRequest("/api/tracks/" + encodeURIComponent(track.id), { method: "DELETE" });
          state.tracks = state.tracks.filter(function (t) {
            return String(t.id) !== String(track.id);
          });
          if (String(state.playingTrackId) === String(track.id)) {
            closePlayerEmbed();
          }
          renderGenreFilters();
          syncTrackListDomWithFlip(null, { animate: true });
          renderSpotlight();
          syncSidebarActiveRoomSummary();
          showFeedback("Faixa removida da fila.", "info");
          refreshStatus();
        } catch (err) {
          showFeedback(err.message || "Não foi possível remover a faixa.", "error");
        }
      }
    );
  }

  /* ========================================================================
     Helpers de Interface: URL Provider Indicator, Quick Chips, Copy Link
     ======================================================================== */

  function updateUrlProviderIndicator(rawUrl) {
    const info = detectProviderFromUrl(rawUrl);
    dom.urlProviderIndicator.textContent = info.label;
    dom.urlProviderIndicator.className = "provider-detector is-" + info.status;
  }

  function initThemeQuickChips() {
    dom.themeQuickChips.replaceChildren();
    THEME_OPTIONS.forEach(function (theme) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-chip-btn";
      btn.dataset.theme = theme;
      btn.textContent = theme;
      btn.addEventListener("click", function () {
        dom.roomThemeSelect.value = theme;
        syncThemeQuickChips();
      });
      dom.themeQuickChips.appendChild(btn);
    });
    syncThemeQuickChips();
  }

  function syncThemeQuickChips() {
    const selected = dom.roomThemeSelect.value;
    const buttons = dom.themeQuickChips.querySelectorAll(".theme-chip-btn");
    buttons.forEach(function (btn) {
      const match = btn.dataset.theme === selected;
      btn.classList.toggle("is-selected", match);
      btn.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }

  async function handleCopyRoomLink() {
    if (!state.activeRoom) return;
    const shareUrl = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const tempInput = document.createElement("input");
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }
      const originalText = dom.copyRoomLinkBtn.textContent;
      dom.copyRoomLinkBtn.textContent = "✓ Link copiado!";
      showFeedback("Link da sala copiado para a área de transferência!", "success", { duration: 3500 });
      window.setTimeout(function () {
        dom.copyRoomLinkBtn.textContent = originalText;
      }, 2200);
    } catch {
      showFeedback("Copie o endereço da barra do navegador para compartilhar a sala.", "info");
    }
  }

  function setupDialogBackdropClose(dialogEl) {
    dialogEl.addEventListener("click", function (event) {
      if (event.target === dialogEl) {
        dialogEl.close();
      }
    });
  }

  /* ========================================================================
     Parâmetros Iniciais da URL (?sala, ?login, ?auth_error)
     ======================================================================== */

  function processInitialUrlParams() {
    try {
      const url = new URL(window.location.href);
      const salaParam = url.searchParams.get("sala");
      const loginParam = url.searchParams.get("login");
      const authErrorParam = url.searchParams.get("auth_error");

      if (salaParam) {
        state.requestedRoomSlug = salaParam;
      }

      let mutated = false;
      if (loginParam === "success") {
        showFeedback("Login com Discord realizado com sucesso! Agora você pode criar salas, sugerir faixas e votar.", "success");
        url.searchParams.delete("login");
        mutated = true;
      } else if (authErrorParam) {
        const friendly =
          AUTH_ERROR_MESSAGES[authErrorParam] ||
          "Não foi possível concluir o login com Discord (" + authErrorParam + ").";
        showFeedback(friendly, "error", { duration: 9000 });
        url.searchParams.delete("auth_error");
        mutated = true;
      }

      if (mutated) {
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch {
      // Ignora URL malformada
    }
  }

  /* ========================================================================
     Registro de Eventos & Boot
     ======================================================================== */

  function bindEvents() {
    dom.feedbackCloseBtn.addEventListener("click", hideFeedback);

    dom.openCreateRoomBtn.addEventListener("click", openCreateRoomDialog);
    dom.emptyCreateRoomBtn.addEventListener("click", openCreateRoomDialog);
    dom.stageCreateRoomBtn.addEventListener("click", openCreateRoomDialog);

    dom.closeCreateRoomDialogBtn.addEventListener("click", function () {
      dom.createRoomDialog.close();
    });
    dom.cancelCreateRoomBtn.addEventListener("click", function () {
      dom.createRoomDialog.close();
    });
    dom.roomThemeSelect.addEventListener("change", syncThemeQuickChips);
    dom.createRoomForm.addEventListener("submit", handleCreateRoom);
    setupDialogBackdropClose(dom.createRoomDialog);

    dom.closeConfirmDialogBtn.addEventListener("click", function () {
      dom.confirmDialog.close();
    });
    dom.cancelConfirmBtn.addEventListener("click", function () {
      dom.confirmDialog.close();
    });
    dom.acceptConfirmBtn.addEventListener("click", async function () {
      const cb = state.confirmCallback;
      state.confirmCallback = null;
      dom.confirmDialog.close();
      if (typeof cb === "function") {
        await cb();
      }
    });
    setupDialogBackdropClose(dom.confirmDialog);

    let searchDebounce = null;
    dom.roomSearchInput.addEventListener("input", function () {
      state.searchQuery = dom.roomSearchInput.value;
      if (searchDebounce) window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(function () {
        loadRooms(state.searchQuery, { autoSelect: false });
      }, 220);
    });

    dom.copyRoomLinkBtn.addEventListener("click", handleCopyRoomLink);
    dom.refreshRoomBtn.addEventListener("click", function () {
      if (state.activeRoom) {
        loadRoomDetail(state.activeRoom.id, { preservePlayer: true, silent: true });
        refreshStatus();
        showFeedback("Fila e votos atualizados.", "info", { duration: 2600 });
      }
    });
    dom.deleteRoomBtn.addEventListener("click", confirmDeleteRoom);

    dom.togglePlayerBtn.addEventListener("click", function () {
      if (state.tracks.length === 0) return;
      if (state.playerOpen) {
        closePlayerEmbed();
      } else {
        state.playerOpen = true;
        if (!state.playingTrackId) {
          state.playingTrackId = state.tracks[0].id;
        }
        renderSpotlight();
        updatePlayingTrackButtons();
      }
    });

    dom.closePlayerBtn.addEventListener("click", closePlayerEmbed);

    dom.returnTopTrackBtn.addEventListener("click", function () {
      if (state.tracks.length === 0) return;
      openTrackInPlayer(state.tracks[0].id);
    });

    dom.trackUrlInput.addEventListener("input", function () {
      updateUrlProviderIndicator(dom.trackUrlInput.value);
    });

    dom.submitTrackForm.addEventListener("submit", handleSubmitTrack);
  }

  async function init() {
    initThemeQuickChips();
    bindEvents();
    processInitialUrlParams();
    updateUrlProviderIndicator("");

    await Promise.all([refreshStatus(), loadCurrentUser()]);
    await loadRooms("", { autoSelect: true });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
