"use strict";
(() => {
  const root = document.documentElement;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const BASE = 0.00004, WARP = 0.0016;
  const PAL = ["#ffffff", "#9bdcff", "#c4a8ff", "#ffe9a8", "#ff9be0"];
  let speed = BASE, target = BASE;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let scrollS = scrollY;
  let stops = [];

  /* ---------- chegada: se voltou do Discord, começa em velocidade de dobra ---------- */
  let arriving = root.classList.contains("arriving");
  try { sessionStorage.removeItem("warp"); } catch {}
  if (arriving && (calm || /auth_error/.test(location.search))) { root.classList.remove("arriving"); arriving = false; }
  if (arriving) speed = target = WARP;

  const flash = document.createElement("div");
  flash.id = "flash";
  flash.setAttribute("aria-hidden", "true");
  document.body.append(flash);

  function land() {
    if (!root.classList.contains("arriving")) return;
    root.classList.remove("arriving");
    target = BASE;
    // reinicia a distribuição das cartas para que o jogador veja a animação
    document.querySelectorAll(".memory-card").forEach((c) => { c.style.animation = "none"; void c.offsetWidth; c.style.animation = ""; });
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

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(t - last, 50) || 16;
    last = t;
    speed += (target - speed) * (1 - Math.exp(-dt / 320));
    mouse.sx += (mouse.x - mouse.sx) * 0.07;
    mouse.sy += (mouse.y - mouse.sy) * 0.07;
    root.style.setProperty("--sx", mouse.sx.toFixed(3));
    root.style.setProperty("--sy", mouse.sy.toFixed(3));
    scrollS += (scrollY - scrollS) * 0.08;

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

    // objetos da jornada: rolagem + mouse em profundidades diferentes
    const reads = stops.map((s) => s.el.getBoundingClientRect());
    stops.forEach((s, i) => {
      const r = reads[i];
      if (r.bottom < -250 || r.top > innerHeight + 250) return;
      const off = r.top + r.height / 2 - innerHeight / 2;
      for (const p of s.px) {
        const sp = +p.dataset.s || 0, m = +p.dataset.m || 18;
        p.style.translate = `${(mouse.sx * m).toFixed(1)}px ${(off * sp + mouse.sy * m).toFixed(1)}px`;
        if (p.classList.contains("obj")) p.style.rotate = (off * -0.012).toFixed(2) + "deg";
      }
    });

    if (!calm) requestAnimationFrame(frame);
  }

  function init() {
    // desenha as ilustrações (definidas no app.js) dentro dos objetos da jornada
    document.querySelectorAll("[data-art]").forEach((el) => {
      const id = el.dataset.art;
      if (typeof buildArt === "function" && typeof ART !== "undefined" && ART[id]) {
        el.style.setProperty("--c1", ART[id][0]);
        el.style.setProperty("--c2", ART[id][1]);
        el.append(buildArt(id));
      }
    });
    stops = [...document.querySelectorAll(".stop")].map((el) => ({ el, px: [...el.querySelectorAll(".px")] }));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.3 });
    stops.forEach((s) => (calm ? s.el.classList.add("in") : io.observe(s.el)));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  requestAnimationFrame(frame);
})();
