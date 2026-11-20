"use strict";
(() => {
  const root = document.documentElement;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const BASE = 0.00004, WARP = 0.0016;
  const PAL = ["#ffffff", "#9bdcff", "#c4a8ff", "#ffe9a8", "#ff9be0"];
  let speed = BASE, target = BASE, boost = 0, lastY = scrollY;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let scrollS = scrollY;
  let scenes = [];
  const flight = $("flight");

  /* ---------- logado ou não: a página inteira reage (boas-vindas, botão final) ---------- */
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

  function land() {
    if (!root.classList.contains("arriving")) return;
    root.classList.remove("arriving");
    setTimeout(autoScroll, 900);
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

  /* ---------- as cartas só são distribuídas quando o jogo entra na tela ---------- */
  const gameEl = $("gameSection");
  if (calm || !("IntersectionObserver" in window)) gameEl.classList.add("seen");
  else {
    new IntersectionObserver((es, o) => {
      if (es.some((e) => e.isIntersecting)) {
        gameEl.classList.add("seen");
        boost = 0.0016;
        o.disconnect();
      }
    }, { threshold: 0.25 }).observe(gameEl);
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

  /* ---------- canvas: estrelas em 3D, dobra, mouse e rolagem ---------- */
  const cv = document.createElement("canvas");
  cv.id = "cosmos";
  cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const g = cv.getContext("2d");
  let W, H, D;
  const rnd = () => (Math.random() - 0.5) * 5.4;
  const stars = Array.from({ length: 280 }, () => ({ x: rnd(), y: rnd(), z: Math.random() * 0.95 + 0.05, c: PAL[(Math.random() * PAL.length) | 0] }));
  const trail = [];
  function size() {
    D = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = Math.round(innerWidth * D);
    H = cv.height = Math.round(innerHeight * D);
  }
  addEventListener("resize", size);
  size();

  addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
    if (calm || speed > 0.0004) return;
    for (let i = 0; i < 2 && trail.length < 90; i++) {
      trail.push({ x: e.clientX * D, y: e.clientY * D, vx: (Math.random() - 0.5) * 0.8 * D, vy: (Math.random() - 0.5) * 0.8 * D + 0.2, l: 1, c: PAL[(Math.random() * PAL.length) | 0] });
    }
  });

  /* ---------- cenas: a câmera atravessa uma após a outra ---------- */
  function fly() {
    const r = flight.getBoundingClientRect();
    const span = r.height - innerHeight;
    const p = span > 0 ? Math.min(Math.max(-r.top / span, 0), 1) : 0;
    root.style.setProperty("--fp", p.toFixed(4));
    const u = p * (scenes.length - 1);
    scenes.forEach((s, i) => {
      const d = u - i;                       // <0: vem de longe · 0: no centro · >0: passou por você
      const sc = d < 0 ? 1 + d * 0.5 : 1 + d * 2.4;
      const op = Math.max(0, Math.min(1, d < 0 ? 1 + d * 1.5 : 1 - d * 2.6));
      const el = s.el;
      el.style.setProperty("--d", d.toFixed(3));
      el.style.visibility = op < 0.01 ? "hidden" : "visible";
      el.style.opacity = op.toFixed(3);
      el.style.transform = `rotateY(${(mouse.sx * 5).toFixed(2)}deg) rotateX(${(-mouse.sy * 4).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      el.style.filter = Math.abs(d) > 0.04 ? `blur(${(Math.abs(d) * 5).toFixed(1)}px)` : "none";
      if (op < 0.01) return;
      for (const q of s.px) {
        const sp = +q.dataset.s || 0, m = +q.dataset.m || 18;
        q.style.translate = `${(mouse.sx * m).toFixed(1)}px ${(mouse.sy * m + d * sp * 600).toFixed(1)}px`;
        if (q.classList.contains("obj")) q.style.rotate = (d * -14).toFixed(2) + "deg";
      }
    });
  }

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(t - last, 50) || 16;
    last = t;

    // quanto mais rápido a rolagem, mais rápido as estrelas passam
    const y = scrollY;
    boost = Math.min(boost + Math.abs(y - lastY) * 0.00001, 0.0016) * 0.94;
    lastY = y;
    const max = root.scrollHeight - innerHeight;
    root.style.setProperty("--prog", max > 0 ? (y / max).toFixed(4) : 0);

    speed += (target + boost - speed) * (1 - Math.exp(-dt / 320));
    mouse.sx += (mouse.x - mouse.sx) * 0.07;
    mouse.sy += (mouse.y - mouse.sy) * 0.07;
    root.style.setProperty("--sx", mouse.sx.toFixed(3));
    root.style.setProperty("--sy", mouse.sy.toFixed(3));
    scrollS += (y - scrollS) * 0.08;

    g.clearRect(0, 0, W, H);
    g.lineCap = "round";
    const k = Math.max(W, H) * 0.18;
    const trailK = 1 + Math.min(speed * 4200, 9);
    for (const s of stars) {
      s.z -= speed * dt;
      if (s.z <= 0.04) { s.z = 1; s.x = rnd(); s.y = rnd(); continue; }
      const near = 1 - s.z;
      const ox = -mouse.sx * 46 * D * near;
      const oy = -mouse.sy * 46 * D * near - scrollS * 0.2 * D * near;
      const hx = (s.x / s.z) * k, hy = (s.y / s.z) * k;
      const tz = Math.min(s.z + speed * dt * trailK + 0.002, 1.6);
      const X = W / 2 + ox + hx, Y = H / 2 + oy + hy;
      if (X < -60 || X > W + 60 || Y < -60 || Y > H + 60) continue;
      g.globalAlpha = Math.min(1, near * 1.6) * (0.75 + 0.25 * Math.sin(t * 0.003 + s.x * 9));
      g.strokeStyle = s.c;
      g.lineWidth = (0.7 + near * 1.8) * D;
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
      p.x += p.vx; p.y += p.vy;
      g.globalAlpha = p.l * 0.8;
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, (p.l * 3 + 0.5) * D, 0, 6.283);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;

    if (!calm) { fly(); requestAnimationFrame(frame); }
  }

  function init() {
    // desenha as ilustrações (definidas no app.js) dentro dos objetos das cenas
    document.querySelectorAll("[data-art]").forEach((el) => {
      const id = el.dataset.art;
      if (typeof buildArt === "function" && typeof ART !== "undefined" && ART[id]) {
        el.style.setProperty("--c1", ART[id][0]);
        el.style.setProperty("--c2", ART[id][1]);
        el.append(buildArt(id));
      }
    });
    scenes = [...document.querySelectorAll(".scene")].map((el) => ({ el, px: [...el.querySelectorAll(".px")] }));
    flight.style.setProperty("--n", scenes.length);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  requestAnimationFrame(frame);
})();
