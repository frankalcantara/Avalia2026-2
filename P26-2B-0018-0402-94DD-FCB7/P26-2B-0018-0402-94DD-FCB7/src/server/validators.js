/**
 * Validadores estritos de entrada e links musicais (YouTube, Spotify e SoundCloud) na borda.
 */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const SPOTIFY_PATH_REGEX =
  /^(?:\/intl-[a-z]{2}(?:-[a-z]{2})?)?\/(track|album|playlist|episode)\/([A-Za-z0-9]{22})\/?$/;

const SOUNDCLOUD_HOSTS = new Set([
  "soundcloud.com",
  "www.soundcloud.com",
  "m.soundcloud.com",
]);

const SOUNDCLOUD_RESERVED_SEGMENTS = new Set([
  "discover",
  "stream",
  "search",
  "upload",
  "you",
  "settings",
  "signin",
  "signup",
  "login",
  "logout",
  "pages",
  "charts",
  "stations",
  "messages",
  "notifications",
  "people",
  "pro",
  "go",
  "mobile",
  "popular",
  "tags",
  "terms-of-use",
]);

const SOUNDCLOUD_SEGMENT_REGEX = /^[A-Za-z0-9._-]{1,120}$/;

const DEFAULT_THEME_TAG = "Foco & Código";

export function slugifyRoomName(name) {
  const normalized = String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return normalized || "sala";
}

export function validateRoomInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dados da sala inválidos." };
  }

  if (typeof body.name !== "string") {
    return { valid: false, error: "O nome da sala é obrigatório." };
  }

  const name = body.name.trim();
  if (name.length < 3 || name.length > 60) {
    return {
      valid: false,
      error: "O nome da sala deve ter entre 3 e 60 caracteres.",
    };
  }

  let description = "";
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      return { valid: false, error: "A descrição da sala deve ser texto." };
    }
    description = body.description.trim();
    if (description.length > 220) {
      return {
        valid: false,
        error: "A descrição da sala deve ter no máximo 220 caracteres.",
      };
    }
  }

  let themeTag = DEFAULT_THEME_TAG;
  if (body.theme_tag !== undefined && body.theme_tag !== null) {
    if (typeof body.theme_tag !== "string") {
      return { valid: false, error: "A tag temática deve ser texto." };
    }
    const trimmedTag = body.theme_tag.trim();
    if (trimmedTag.length > 0) {
      if (trimmedTag.length < 2 || trimmedTag.length > 30) {
        return {
          valid: false,
          error: "A tag temática deve ter entre 2 e 30 caracteres.",
        };
      }
      themeTag = trimmedTag;
    }
  }

  return {
    valid: true,
    value: {
      name,
      description,
      theme_tag: themeTag,
    },
  };
}

export function validateTrackUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    return { valid: false, error: "A URL da faixa é obrigatória." };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) {
    return { valid: false, error: "URL da faixa inválida ou longa demais." };
  }

  // Rejeita explicitamente qualquer esquema diferente de https:// (http:, javascript:, data:, etc.)
  if (!trimmed.startsWith("https://")) {
    return {
      valid: false,
      error: "Apenas links seguros com protocolo https:// são aceitos.",
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "URL malformada." };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "Apenas links seguros com protocolo https:// são aceitos.",
    };
  }

  if (parsed.username || parsed.password || parsed.port) {
    return {
      valid: false,
      error: "URL inválida: credenciais ou portas customizadas não são permitidas.",
    };
  }

  const host = parsed.hostname.toLowerCase();

  // 1. YouTube
  if (YOUTUBE_HOSTS.has(host)) {
    let videoId = null;

    if (host === "youtu.be") {
      const match = parsed.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/);
      if (match) {
        videoId = match[1];
      }
    } else if (parsed.pathname === "/watch" || parsed.pathname === "/watch/") {
      videoId = parsed.searchParams.get("v");
    } else {
      const match = parsed.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/);
      if (match) {
        videoId = match[1];
      }
    }

    if (!videoId || !YOUTUBE_ID_REGEX.test(videoId)) {
      return {
        valid: false,
        error: "Link do YouTube inválido. Informe um vídeo válido (/watch?v=..., youtu.be/..., /shorts/... ou /embed/...).",
      };
    }

    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;

    return {
      valid: true,
      provider: "youtube",
      normalizedUrl,
      embedUrl,
    };
  }

  // 2. Spotify
  if (host === "open.spotify.com") {
    const match = parsed.pathname.match(SPOTIFY_PATH_REGEX);
    if (!match) {
      return {
        valid: false,
        error: "Link do Spotify inválido. Utilize uma URL de track, album, playlist ou episode em open.spotify.com.",
      };
    }

    const [, type, id] = match;
    const normalizedUrl = `https://open.spotify.com/${type}/${id}`;
    const embedUrl = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;

    return {
      valid: true,
      provider: "spotify",
      normalizedUrl,
      embedUrl,
    };
  }

  // 3. SoundCloud
  if (SOUNDCLOUD_HOSTS.has(host)) {
    const segments = parsed.pathname.split("/").filter(Boolean);

    const isTrackPath = segments.length === 2;
    const isPlaylistPath = segments.length === 3 && segments[1].toLowerCase() === "sets";

    if (!isTrackPath && !isPlaylistPath) {
      return {
        valid: false,
        error: "Link do SoundCloud inválido. Informe uma faixa (/artista/faixa) ou playlist (/artista/sets/playlist).",
      };
    }

    const artist = segments[0].toLowerCase();
    if (SOUNDCLOUD_RESERVED_SEGMENTS.has(artist)) {
      return {
        valid: false,
        error: "Links de páginas internas do SoundCloud não são faixas válidas.",
      };
    }

    for (const seg of segments) {
      if (
        !SOUNDCLOUD_SEGMENT_REGEX.test(seg) ||
        seg === "." ||
        seg === ".." ||
        seg.includes("..")
      ) {
        return {
          valid: false,
          error: "Link do SoundCloud contém caracteres inválidos no caminho.",
        };
      }
    }

    const normalizedUrl = `https://soundcloud.com/${segments.join("/")}`;
    const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(normalizedUrl)}&color=%234f46e5&auto_play=false&show_teaser=false`;

    return {
      valid: true,
      provider: "soundcloud",
      normalizedUrl,
      embedUrl,
    };
  }

  return {
    valid: false,
    error: "Provedor não suportado. Envie links HTTPS do YouTube, Spotify ou SoundCloud.",
  };
}

export function validateTrackInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dados da faixa inválidos." };
  }

  if (typeof body.title !== "string") {
    return { valid: false, error: "O título da faixa é obrigatório." };
  }
  const title = body.title.trim();
  if (title.length < 2 || title.length > 120) {
    return {
      valid: false,
      error: "O título da faixa deve ter entre 2 e 120 caracteres.",
    };
  }

  let artist = "";
  if (body.artist !== undefined && body.artist !== null) {
    if (typeof body.artist !== "string") {
      return { valid: false, error: "O nome do artista deve ser texto." };
    }
    artist = body.artist.trim();
    if (artist.length > 80) {
      return {
        valid: false,
        error: "O nome do artista deve ter no máximo 80 caracteres.",
      };
    }
  }

  if (typeof body.genre !== "string") {
    return { valid: false, error: "O gênero musical é obrigatório." };
  }
  const genre = body.genre.trim();
  if (genre.length < 2 || genre.length > 40) {
    return {
      valid: false,
      error: "O gênero musical deve ter entre 2 e 40 caracteres.",
    };
  }

  const urlCheck = validateTrackUrl(body.url);
  if (!urlCheck.valid) {
    return { valid: false, error: urlCheck.error };
  }

  return {
    valid: true,
    value: {
      title,
      artist,
      genre,
      url: body.url.trim(),
      provider: urlCheck.provider,
      normalizedUrl: urlCheck.normalizedUrl,
      embedUrl: urlCheck.embedUrl,
    },
  };
}

export function validateVoteValue(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dados do voto inválidos." };
  }

  const { value } = body;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    (value !== -1 && value !== 0 && value !== 1)
  ) {
    return {
      valid: false,
      error: "O valor do voto deve ser um inteiro igual a -1, 0 ou 1.",
    };
  }

  return { valid: true, value };
}
