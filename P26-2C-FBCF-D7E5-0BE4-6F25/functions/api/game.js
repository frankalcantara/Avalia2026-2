
const PALAVRAS = [
  "ABRIR", "AMIGO", "ARROZ", "AVIAO", "BAIXO",
  "BANCO", "BARCO", "BEBER", "BOLSA", "BRAVO",
  "CABER", "CAMPO", "CANTO", "CARRO", "CASAL",
  "CHAVE", "CINCO", "CLARO", "COBRA", "CORPO",
  "DANCA", "DEDOS", "DENTE", "DOIDO", "FALAR",
  "FELIZ", "FESTA", "FILHO", "FLORA", "FOCAR",
  "FRUTA", "GATOS", "GENTE", "GRUPO", "HORAS",
  "JOGAR", "LIVRO", "LUGAR", "MUNDO", "NOITE",
  "NORTE", "OLHAR", "ONTEM", "PEDRA", "PEIXE",
  "PORTA", "PRATO", "RAIVA", "SABER", "SAUDE",
  "TEMPO", "TERRA", "TEXTO", "TOQUE", "VALOR",
  "VERDE", "VIVER", "VISTA"
];

function base64urlParaBytes(valor) {
  const base64 = valor.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function validarAssinatura(valor, assinatura, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    base64urlParaBytes(assinatura),
    new TextEncoder().encode(valor)
  );
}

function obterCookie(request, nome) {
  const cookies = request.headers.get("Cookie") || "";

  for (const item of cookies.split(";")) {
    const [chave, ...valor] = item.trim().split("=");
    if (chave === nome) return valor.join("=");
  }

  return null;
}

async function obterUsuario(request, env) {
  if (!env.SESSION_SECRET) return null;

  const cookie = obterCookie(request, "discord_session");
  if (!cookie) return null;

  const separador = cookie.lastIndexOf(".");
  if (separador < 1) return null;

  const payload = cookie.slice(0, separador);
  const assinatura = cookie.slice(separador + 1);

  try {
    const valido = await validarAssinatura(
      payload,
      assinatura,
      env.SESSION_SECRET
    );

    if (!valido) return null;

    const usuario = JSON.parse(
      new TextDecoder().decode(base64urlParaBytes(payload))
    );

    return usuario.userId && usuario.username ? usuario : null;
  } catch {
    return null;
  }
}

function normalizarPalavra(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function avaliarTentativa(tentativa, resposta) {
  const resultado = Array(5).fill("absent");
  const letras = resposta.split("");
  const restantes = {};

  for (const letra of letras) {
    restantes[letra] = (restantes[letra] || 0) + 1;
  }

  for (let i = 0; i < 5; i++) {
    if (tentativa[i] === resposta[i]) {
      resultado[i] = "correct";
      restantes[tentativa[i]]--;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (resultado[i] === "correct") continue;

    const letra = tentativa[i];

    if (restantes[letra] > 0) {
      resultado[i] = "present";
      restantes[letra]--;
    }
  }

  return resultado;
}

async function obterPalavraDoDia(env, data) {
  const numero = Number(data.replace(/-/g, ""));
  const indice = numero % PALAVRAS.length;
  const palavra = PALAVRAS[indice];

  await env.DB.prepare(
    "INSERT OR IGNORE INTO daily_words (game_date, word) VALUES (?, ?)"
  ).bind(data, palavra).run();

  const registro = await env.DB.prepare(
    "SELECT word FROM daily_words WHERE game_date = ?"
  ).bind(data).first();

  return registro.word;
}

async function obterPartida(env, userId, data) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO user_daily_games (user_id, game_date) VALUES (?, ?)"
  ).bind(userId, data).run();

  return env.DB.prepare(
    "SELECT * FROM user_daily_games WHERE user_id = ? AND game_date = ?"
  ).bind(userId, data).first();
}

async function obterEstado(env, usuario, data, partida) {
  const registros = await env.DB.prepare(
    "SELECT guess, result FROM game_guesses WHERE game_id = ? ORDER BY guess_number"
  ).bind(partida.id).all();

  const estatisticas = await env.DB.prepare(
    "SELECT * FROM user_stats WHERE user_id = ?"
  ).bind(usuario.userId).first();

  const distribuicao = await env.DB.prepare(
    "SELECT guess_count, total FROM guess_distribution WHERE user_id = ?"
  ).bind(usuario.userId).all();

  const distribution = {};

  for (let i = 1; i <= 6; i++) {
    distribution[i] = 0;
  }

  for (const item of distribuicao.results || []) {
    distribution[item.guess_count] = item.total;
  }

  return {
    authenticated: true,
    user: { username: usuario.username },
    gameDate: data,
    guesses: (registros.results || []).map(item => ({
      guess: item.guess,
      result: JSON.parse(item.result)
    })),
    status: partida.status,
    stats: {
      gamesPlayed: estatisticas?.games_played || 0,
      gamesWon: estatisticas?.games_won || 0,
      currentStreak: estatisticas?.current_streak || 0,
      maxStreak: estatisticas?.max_streak || 0,
      distribution
    }
  };
}

async function atualizarEstatisticas(env, userId, data, status, tentativas) {
  if (status === "won") {
    await env.DB.prepare(`
      INSERT INTO user_stats
        (user_id, games_played, games_won, current_streak, max_streak, last_played_date)
      VALUES (?, 1, 1, 1, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        games_played = games_played + 1,
        games_won = games_won + 1,
        current_streak = CASE
          WHEN last_played_date = date(?, '-1 day') THEN current_streak + 1
          WHEN last_played_date = ? THEN current_streak
          ELSE 1
        END,
        max_streak = MAX(max_streak,
          CASE
            WHEN last_played_date = date(?, '-1 day') THEN current_streak + 1
            WHEN last_played_date = ? THEN current_streak
            ELSE 1
          END
        ),
        last_played_date = ?
    `).bind(userId, data, data, data, data, data, data).run();

    await env.DB.prepare(`
      INSERT INTO guess_distribution (user_id, guess_count, total)
      VALUES (?, ?, 1)
      ON CONFLICT(user_id, guess_count)
      DO UPDATE SET total = total + 1
    `).bind(userId, tentativas).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO user_stats
        (user_id, games_played, games_lost, current_streak, last_played_date)
      VALUES (?, 1, 1, 0, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        games_played = games_played + 1,
        games_lost = games_lost + 1,
        current_streak = 0,
        last_played_date = ?
    `).bind(userId, data, data).run();
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    return Response.json(
      { error: "Banco de dados indisponível." },
      { status: 503 }
    );
  }

  const usuario = await obterUsuario(request, env);

  if (!usuario) {
    return Response.json(
      { authenticated: false, error: "Faça login com Discord." },
      { status: 401 }
    );
  }

  try {
    const data = new Date().toISOString().slice(0, 10);
    const resposta = await obterPalavraDoDia(env, data);
    const partida = await obterPartida(env, usuario.userId, data);

    if (request.method === "GET") {
      return Response.json(
        await obterEstado(env, usuario, data, partida)
      );
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Método não permitido." },
        { status: 405 }
      );
    }

    if (partida.status !== "playing") {
      return Response.json(
        await obterEstado(env, usuario, data, partida)
      );
    }

    const body = await request.json().catch(() => ({}));
    const tentativa = normalizarPalavra(body.guess);

    if (tentativa.length !== 5 || !PALAVRAS.includes(tentativa)) {
      return Response.json(
        { error: "Digite uma palavra válida de cinco letras." },
        { status: 400 }
      );
    }

    const numero = partida.attempts + 1;

    if (numero > 6) {
      return Response.json(
        { error: "Você já utilizou suas seis tentativas." },
        { status: 400 }
      );
    }

    const resultado = avaliarTentativa(tentativa, resposta);
    const venceu = tentativa === resposta;
    const perdeu = !venceu && numero === 6;
    const novoStatus = venceu ? "won" : perdeu ? "lost" : "playing";

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO game_guesses (game_id, guess_number, guess, result)
        VALUES (?, ?, ?, ?)
      `).bind(partida.id, numero, tentativa, JSON.stringify(resultado)),

      env.DB.prepare(`
        UPDATE user_daily_games
        SET attempts = ?, status = ?,
            completed_at = CASE WHEN ? = 'playing' THEN NULL
                                ELSE CURRENT_TIMESTAMP END
        WHERE id = ? AND status = 'playing'
      `).bind(numero, novoStatus, novoStatus, partida.id)
    ]);

    if (novoStatus !== "playing") {
      await atualizarEstatisticas(
        env, usuario.userId, data, novoStatus, numero
      );
    }

    const partidaAtualizada = await obterPartida(
      env, usuario.userId, data
    );

    return Response.json(
      await obterEstado(env, usuario, data, partidaAtualizada)
    );
  } catch (erro) {
    return Response.json(
      { error: "Erro ao processar a partida." },
      { status: 500 }
    );
  }
}
