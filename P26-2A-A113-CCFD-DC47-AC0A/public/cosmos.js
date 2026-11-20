"use strict";
(() => {
  const root = document.documentElement;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const BASE = 0.00004, WARP = 0.0016;
  const PAL = ["#ffffff", "#9bdcff", "#c4a8ff", "#ffe9a8", "#ff9be0"];
  let speed = BASE, target = BASE, boost = 0, lastY = scrollY, scrollS = scrollY;
  const mouse = { x: 0, y: 0, gx: -9999, gy: -9999, sx: 0, sy: 0, v: 0, seen: false };
  let glowA = 0, ps = 0, scenes = [], gameVisible = false;
  const lastFly = { p: -1, sx: 9, sy: 9 };
  const flight = $("flight");

  /* ---------- logado ou não ---------- */
  const loginEl = $("loginPrompt");
  const syncAuth = () => root.classList.toggle("authed", loginEl.hidden);
  new MutationObserver(syncAuth).observe(loginEl, { attributes: true, attributeFilter: ["hidden"] });
  syncAuth();

  /* ---------- chegada: voltou do Discord, começa em velocidade de dobra ---------- */
  let arriving = root.classList.contains("arriving");
  try { sessionStorage.removeItem("warp"); } catch {}
  if (arriving && (calm || /auth_error/.test(location.search))) { root.classList.remove("arriving"); arriving = false; }
  if (arriving) {
    speed = target = WARP;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    scrollTo({ top: 0, behavior: "instant" });
  }

  const flash = document.createElement("div");
  flash.id = "flash";
  flash.setAttribute("aria-hidden", "true");
  document.body.append(flash);

  function land() {
    if (!root.classList.contains("arriving")) return;
    root.classList.remove("arriving");
    target = BASE; // as estrelas desaceleram e o jogador assume a rolagem
  }
  if (arriving) {
    const game = $("gameSection"), board = $("board");
    const obs = new MutationObserver(() => {
      if (!game.hidden && board.children.length) { obs.disconnect(); setTimeout(land, 300); }
    });
    obs.observe(game, { attributes: true, attributeFilter: ["hidden"] });
    obs.observe(board, { childList: true });
    setTimeout(() => { obs.disconnect(); land(); }, 4500);
  }

  /* ---------- jogo: cartas só são distribuídas quando ele aparece ---------- */
  const gameEl = $("gameSection");
  const boardEl = $("board");
  if (calm || !("IntersectionObserver" in window)) gameEl.classList.add("seen");
  else {
    new IntersectionObserver((es) => {
      gameVisible = es.some((e) => e.isIntersecting);
      if (gameVisible && !gameEl.classList.contains("seen")) { gameEl.classList.add("seen"); boost = 0.0016; }
      if (!gameVisible) boardEl.style.transform = "";
    }, { threshold: 0.2 }).observe(gameEl);
  }

  /* ---------- clique em "Entrar": viaja até o Discord ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href="/api/auth/discord"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || calm) return;
    e.preventDefault();
    if (root.classList.contains("warping")) return;
    try { sessionStorage.setItem("warp", "1"); } catch {}
    root.classList.add("warping");
    target = WARP;
    setTimeout(() => { location.href = a.href; }, 1400);
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted) { root.classList.remove("warping", "arriving"); target = BASE; }
  });

  /* ---------- canvas ---------- */
  const cv = document.createElement("canvas");
  cv.id = "cosmos";
  cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const g = cv.getContext("2d");
  let W, H, D;
  const rnd = () => (Math.random() - 0.5) * 5.4;
  const mk = () => ({ x: rnd(), y: rnd(), z: Math.random() * 0.95 + 0.05, c: PAL[(Math.random() * PAL.length) | 0], ox: 0, oy: 0, vx: 0, vy: 0 });
  const stars = Array.from({ length: 260 }, mk);
  const trail = [];
  function size() {
    D = Math.min(devicePixelRatio || 1, 1.5);
    W = cv.width = Math.round(innerWidth * D);
    H = cv.height = Math.round(innerHeight * D);
  }
  addEventListener("resize", size);
  size();

  // luz do mouse: desenhada uma vez e reaproveitada (barato)
  const spr = document.createElement("canvas");
  spr.width = spr.height = 256;
  const sg = spr.getContext("2d");
  const gr = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,.6)");
  gr.addColorStop(0.16, "rgba(167,139,250,.42)");
  gr.addColorStop(0.5, "rgba(124,58,237,.15)");
  gr.addColorStop(1, "rgba(124,58,237,0)");
  sg.fillStyle = gr;
  sg.fillRect(0, 0, 256, 256);

  addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!mouse.seen) { mouse.seen = true; if (mouse.gx < -999) { mouse.gx = e.clientX; mouse.gy = e.clientY; } }
    if (calm || speed > 0.0004) return;
    for (let i = 0; i < 2 && trail.length < 70; i++) {
      trail.push({ x: e.clientX * D, y: e.clientY * D, vx: (Math.random() - 0.5) * 0.8 * D, vy: (Math.random() - 0.5) * 0.8 * D + 0.2, l: 1, c: PAL[(Math.random() * PAL.length) | 0] });
    }
  }, { passive: true });
  root.addEventListener("mouseleave", () => { mouse.seen = false; });

  /* ---------- viagem: cenas, com inércia e sem blur ---------- */
  const bar = document.createElement("div");
  bar.id = "bar";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);
  const strip = document.querySelector(".strip"), cue = document.querySelector(".cue");
  const planet = document.querySelector(".sky .planet"), orbits = document.querySelector(".orbits");

  function fly() {
    const u = ps * (scenes.length - 1);
    scenes.forEach((s, i) => {
      const d = u - i;                        // <0: vem de longe · 0: centro · >0: passou por você
      const op = Math.max(0, Math.min(1, d < 0 ? 1 + d * 1.5 : 1 - d * 2.6));
      const el = s.el;
      if (op < 0.01) {
        if (!s.h) { el.style.visibility = "hidden"; s.h = true; }
        return;
      }
      if (s.h) { el.style.visibility = "visible"; s.h = false; }
      const sc = d < 0 ? 1 + d * 0.5 : 1 + d * 2.4;
      el.style.opacity = op.toFixed(3);
      el.style.transform = `rotateY(${(mouse.sx * 5).toFixed(2)}deg) rotateX(${(-mouse.sy * 4).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      for (const q of s.px) {
        const sp = +q.dataset.s || 0, m = +q.dataset.m || 18;
        q.style.translate = `${(mouse.sx * m).toFixed(1)}px ${(mouse.sy * m + d * sp * 600).toFixed(1)}px`;
        if (q.classList.contains("obj")) q.style.rotate = (d * -14).toFixed(2) + "deg";
      }
    });
    if (strip) strip.style.opacity = Math.max(0, 1 - ps * 9).toFixed(3);
    if (cue) cue.style.opacity = Math.max(0, 1 - ps * 14).toFixed(3);
    if (planet) planet.style.translate = `${(mouse.sx * -44).toFixed(1)}px ${(mouse.sy * -34).toFixed(1)}px`;
    if (orbits) orbits.style.translate = `${(mouse.sx * 22).toFixed(1)}px ${(mouse.sy * 22).toFixed(1)}px`;
    if (gameVisible) boardEl.style.transform = `rotateX(${(mouse.sy * -2.5).toFixed(2)}deg) rotateY(${(mouse.sx * 3).toFixed(2)}deg)`;
  }

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(t - last, 50) || 16;
    last = t;
    const f = dt / 16.67;

    // rolagem: as estrelas aceleram com a velocidade; a viagem tem inércia
    const y = scrollY;
    boost = Math.min(boost + Math.abs(y - lastY) * 0.00001, 0.0016) * 0.94;
    lastY = y;
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    const fr = flight.getBoundingClientRect(), span = fr.height - innerHeight;
    const pRaw = span > 0 ? Math.min(Math.max(-fr.top / span, 0), 1) : 0;
    ps += (pRaw - ps) * (1 - Math.exp(-dt / 120));
    scrollS += (y - scrollS) * (1 - Math.exp(-dt / 140));

    speed += (target + boost - speed) * (1 - Math.exp(-dt / 320));

    // luz do mouse: segue com suavidade
    if (mouse.seen) {
      const px = mouse.gx, py = mouse.gy, k1 = 1 - Math.exp(-dt / 90);
      mouse.gx += (mouse.x - mouse.gx) * k1;
      mouse.gy += (mouse.y - mouse.gy) * k1;
      mouse.v += (Math.min((Math.hypot(mouse.gx - px, mouse.gy - py) / dt) * 0.9, 1) - mouse.v) * 0.1;
    } else mouse.v *= 0.9;
    glowA += ((mouse.seen ? 1 : 0) - glowA) * (1 - Math.exp(-dt / 220));
    const nx = mouse.seen ? (mouse.gx / innerWidth) * 2 - 1 : 0, ny = mouse.seen ? (mouse.gy / innerHeight) * 2 - 1 : 0;
    mouse.sx += (nx - mouse.sx) * (1 - Math.exp(-dt / 160));
    mouse.sy += (ny - mouse.sy) * (1 - Math.exp(-dt / 160));

    // só mexe no DOM quando algo mudou de verdade
    if (Math.abs(ps - lastFly.p) > 0.00008 || Math.abs(mouse.sx - lastFly.sx) > 0.0006 || Math.abs(mouse.sy - lastFly.sy) > 0.0006) {
      lastFly.p = ps; lastFly.sx = mouse.sx; lastFly.sy = mouse.sy;
      fly();
    }

    g.clearRect(0, 0, W, H);
    const mx = mouse.gx * D, my = mouse.gy * D, active = glowA > 0.04;
    if (active) {
      const R = (210 + mouse.v * 150) * D;
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.min(1, glowA * (0.55 + mouse.v * 0.45));
      g.drawImage(spr, mx - R, my - R, R * 2, R * 2);
      g.globalCompositeOperation = "source-over";
    }

    g.lineCap = "round";
    const k = Math.max(W, H) * 0.18;
    const trailK = 1 + Math.min(speed * 4200, 9);
    const FR = 175 * D, FR2 = FR * FR, damp = Math.pow(0.9, f);
    for (const s of stars) {
      s.z -= speed * dt;
      if (s.z <= 0.04) { Object.assign(s, mk(), { z: 1 }); continue; }
      const near = 1 - s.z;
      const hx = (s.x / s.z) * k, hy = (s.y / s.z) * k;
      const X0 = W / 2 - mouse.sx * 46 * D * near + hx;
      const Y0 = H / 2 - mouse.sy * 46 * D * near - scrollS * 0.2 * D * near + hy;

      // campo de força: a luz empurra e gira as estrelas; elas voltam como mola
      let lit = 0;
      if (active) {
        const dx = X0 + s.ox - mx, dy = Y0 + s.oy - my, d2 = dx * dx + dy * dy;
        if (d2 < FR2 && d2 > 1) {
          const d = Math.sqrt(d2), q = 1 - d / FR, push = q * q * (1.3 + mouse.v * 3.2) * D * glowA * f;
          s.vx += (dx / d) * push - (dy / d) * push * 0.35;
          s.vy += (dy / d) * push + (dx / d) * push * 0.35;
          lit = q;
        }
      }
      s.vx = (s.vx - s.ox * 0.035 * f) * damp;
      s.vy = (s.vy - s.oy * 0.035 * f) * damp;
      s.ox += s.vx * f;
      s.oy += s.vy * f;

      const X = X0 + s.ox, Y = Y0 + s.oy;
      if (X < -60 || X > W + 60 || Y < -60 || Y > H + 60) continue;
      const tz = Math.min(s.z + speed * dt * trailK + 0.002, 1.6);
      g.globalAlpha = Math.min(1, near * 1.6 * (0.75 + 0.25 * Math.sin(t * 0.003 + s.x * 9)) + lit * 0.5);
      g.strokeStyle = s.c;
      g.lineWidth = (0.7 + near * 1.8 + lit * 1.6) * D;
      g.beginPath();
      g.moveTo(X, Y);
      g.lineTo(X + (s.x / tz) * k - hx, Y + (s.y / tz) * k - hy);
      g.stroke();
    }

    g.globalCompositeOperation = "lighter";
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      p.l -= dt / 700;
      if (p.l <= 0) { trail.splice(i, 1); continue; }
      p.x += p.vx * f; p.y += p.vy * f;
      g.globalAlpha = p.l * 0.8;
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, (p.l * 3 + 0.5) * D, 0, 6.283);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;

    if (!calm) requestAnimationFrame(frame);
  }

  function init() {
    document.querySelectorAll("[data-art]").forEach((el) => {
      const id = el.dataset.art;
      if (typeof buildArt === "function" && typeof ART !== "undefined" && ART[id]) {
        el.style.setProperty("--c1", ART[id][0]);
        el.style.setProperty("--c2", ART[id][1]);
        el.append(buildArt(id));
      }
    });
    scenes = [...document.querySelectorAll(".scene")].map((el) => ({ el, px: [...el.querySelectorAll(".px")], h: undefined }));
    flight.style.setProperty("--n", scenes.length);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  requestAnimationFrame(frame);
})();
