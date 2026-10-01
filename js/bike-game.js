// js/bike-game.js
//
// A tiny endless-runner in the style of Chrome's offline dinosaur game,
// but with a bicycle. Everything is drawn on a <canvas> with pixel-art
// primitives, so there are no image files to load.
//
//   const game = createBikeGame(canvasElement, { onExit(bestKm) { ... } });
//   game.open();   // starts the loop and listens for the keyboard
//   game.close();  // stops everything
//
// Controls: Space / ArrowUp = jump, ArrowDown = duck, Esc = exit.
// Touch: tap = jump, hold the bottom part of the canvas = duck.

(function () {
  "use strict";

  // ---------- Game constants (logical pixels, canvas is 600x150) ----------
  const W = 600;
  const H = 150;
  const GROUND = 130; // y of the ground line
  const P = 2; // size of one "art pixel"

  const PX_PER_KM = 30000; // how many logical pixels count as 1 km
  const START_SPEED = 260; // px / second
  const MAX_SPEED = 560;
  const ACCEL = 9;
  const GRAVITY = 1640;
  const JUMP_V = 460; // jump apex is about 64px

  const HI_KEY = "bike-game-best-km";

  // ---------- Pixel sprites ('#' = filled art pixel) ----------
  const CLOUD = [
    "........####..........",
    "....####....###.......",
    "..##..........###.....",
    ".#...............##...",
    "#.................###.",
    ".####################.",
  ];

  const CONE = [
    "...#...",
    "...#...",
    "..###..",
    "..###..",
    "..#.#..",
    ".#####.",
    ".#####.",
    ".#...#.",
    "#######",
    "#######",
  ];

  const GULL = [
    [
      "#...........#",
      "##.........##",
      ".##.......##.",
      "..##..#..##..",
      "...#######...",
      ".....###.....",
    ],
    [
      ".............",
      ".....###.....",
      "..###.#.###..",
      ".##.#####.##.",
      "##.........##",
      "#...........#",
    ],
  ];

  // 3x5 pixel font for the score and the GAME OVER text
  const FONT = {
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", "###", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", "..#", "..#", "..#"],
    "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "###"],
    ".": ["...", "...", "...", "...", ".#."],
    " ": ["...", "...", "...", "...", "..."],
    A: [".#.", "#.#", "###", "#.#", "#.#"],
    E: ["###", "#..", "##.", "#..", "###"],
    G: [".##", "#..", "#.#", "#.#", ".##"],
    H: ["#.#", "#.#", "###", "#.#", "#.#"],
    I: ["###", ".#.", ".#.", ".#.", "###"],
    K: ["#.#", "#.#", "##.", "#.#", "#.#"],
    M: ["#.#", "###", "###", "#.#", "#.#"],
    O: ["###", "#.#", "#.#", "#.#", "###"],
    R: ["##.", "#.#", "##.", "#.#", "#.#"],
    V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  };

  // ---------- Small helpers ----------
  const rand = (min, max) => min + Math.random() * (max - min);

  function plotLine(x0, y0, x1, y1, plot) {
    // Bresenham's line algorithm on integer art pixels
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      plot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function loadBest() {
    try {
      const v = parseFloat(localStorage.getItem(HI_KEY));
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(v) {
    try {
      localStorage.setItem(HI_KEY, String(v));
    } catch (e) {
      /* storage can be unavailable (private mode); ignore */
    }
  }

  const formatKm = (km) => Math.min(km, 99.99).toFixed(2).padStart(5, "0");

  // ---------- The game ----------
  function createBikeGame(canvas, options) {
    options = options || {};
    const ctx = canvas.getContext("2d");

    const css = getComputedStyle(document.documentElement);
    const colors = {
      fg: (css.getPropertyValue("--fg") || "").trim() || "#f8f8f2",
      dim: (css.getPropertyValue("--comment") || "").trim() || "#6272a4",
    };

    let scale = 1; // device pixels per logical pixel
    let isOpen = false;
    let rafId = 0;
    let lastTs = 0;

    let state = "idle"; // idle | run | dead
    let best = loadBest();

    // run state
    let speed, dist, feetY, vy, onGround, ducking;
    let wheelAngle, crankAngle, sinceSpawn, nextGap, flash, lastTenth, deadAt, time;
    let obstacles, clouds, bumps;

    function reset() {
      speed = START_SPEED;
      dist = 0;
      feetY = GROUND;
      vy = 0;
      onGround = true;
      ducking = false;
      wheelAngle = 0;
      crankAngle = 0;
      sinceSpawn = 0;
      nextGap = 520;
      flash = 0;
      lastTenth = 0;
      deadAt = 0;
      time = 0;
      obstacles = [];
      clouds = [
        { x: 120, y: 30 },
        { x: 380, y: 52 },
        { x: 560, y: 24 },
      ];
      bumps = [];
      for (let x = 0; x < W + 40; x += rand(18, 60)) {
        bumps.push({ x: x, y: Math.floor(rand(0, 3)) * 4, w: Math.random() < 0.5 ? 2 : 4 });
      }
    }

    // ---------- Drawing primitives (snapped to device pixels, so no seams) ----------
    function rect(x, y, w, h) {
      const x0 = Math.round(x * scale);
      const y0 = Math.round(y * scale);
      const x1 = Math.round((x + w) * scale);
      const y1 = Math.round((y + h) * scale);
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }

    function drawSprite(rows, ox, oy) {
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 0; c < row.length; c++) {
          if (row[c] === "#") rect(ox + c * P, oy + r * P, P, P);
        }
      }
    }

    function drawText(str, x, y, sc) {
      for (let i = 0; i < str.length; i++) {
        const glyph = FONT[str[i]] || FONT[" "];
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 3; c++) {
            if (glyph[r][c] === "#") rect(x + c * sc, y + r * sc, sc, sc);
          }
        }
        x += 4 * sc;
      }
    }

    const textWidth = (str, sc) => str.length * 4 * sc - sc;

    // ---------- The bicycle (drawn procedurally, ~32 x 26 art pixels) ----------
    function drawBike(ox, oy, pose) {
      const u = (x, y) => rect(ox + x * P, oy + y * P, P, P);
      const thick = (x0, y0, x1, y1) => {
        const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
        plotLine(x0, y0, x1, y1, (x, y) => {
          u(x, y);
          if (steep) u(x + 1, y);
          else u(x, y + 1);
        });
      };
      const thin = (x0, y0, x1, y1) => plotLine(x0, y0, x1, y1, u);

      const wheel = (cx, cy) => {
        for (let y = Math.floor(cy - 6); y <= Math.ceil(cy + 6); y++) {
          for (let x = Math.floor(cx - 6); x <= Math.ceil(cx + 6); x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (d > 4.55 && d < 5.45) u(x, y);
          }
        }
        for (let k = 0; k < 2; k++) {
          const a = pose.wheel + (k * Math.PI) / 2;
          for (let r = -4.0; r <= 4.0; r += 0.5) {
            u(Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r));
          }
        }
      };

      // key points of the frame, in art pixels
      const rear = [6, 20];
      const front = [26, 20];
      const bb = [15, 19];
      const seat = [13, 9];
      const head = [23, 10];
      const hip = [13, 7];
      const shoulder = pose.tuck ? [22, 8] : [19, 3];
      const headC = pose.tuck ? [25, 6.5] : [20.5, 2.4];

      // knee position for a foot target, using two-bone IK
      const kneeFor = (foot) => {
        const a = 8; // thigh
        const b = 9; // shin
        const dx = foot[0] - hip[0];
        const dy = foot[1] - hip[1];
        const d = Math.min(Math.hypot(dx, dy), a + b - 0.1);
        const ux = dx / d;
        const uy = dy / d;
        const x = (a * a - b * b + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, a * a - x * x));
        const k1 = [hip[0] + ux * x - uy * h, hip[1] + uy * x + ux * h];
        const k2 = [hip[0] + ux * x + uy * h, hip[1] + uy * x - ux * h];
        return k1[0] > k2[0] ? k1 : k2; // knee points forward
      };
      const footAt = (phi) => [bb[0] + 3.5 * Math.cos(phi), bb[1] + 3.5 * Math.sin(phi)];

      // far leg (dim, behind the frame)
      ctx.fillStyle = colors.dim;
      const farFoot = footAt(pose.crank + Math.PI);
      const farKnee = kneeFor(farFoot);
      thin(hip[0], hip[1], farKnee[0], farKnee[1]);
      thin(farKnee[0], farKnee[1], farFoot[0], farFoot[1]);
      u(Math.round(farFoot[0]) + 1, Math.round(farFoot[1]));

      // bike
      ctx.fillStyle = colors.fg;
      wheel(rear[0] + 0.5, 20.5);
      wheel(front[0] + 0.5, 20.5);
      thin(bb[0], bb[1], seat[0], seat[1]); // seat tube
      thin(seat[0], seat[1], head[0], head[1]); // top tube
      thin(bb[0], bb[1], head[0], head[1]); // down tube
      thin(bb[0], bb[1], rear[0], rear[1]); // chain stay
      thin(seat[0], seat[1], rear[0], rear[1]); // seat stay
      thin(head[0], head[1], front[0], front[1]); // fork
      thin(11, 8, 14, 8); // saddle
      thin(head[0], head[1], 24, 8); // stem
      thin(24, 8, 27, 8); // handlebar
      thin(27, 8, 28, 9);
      thin(28, 9, 28, 10);
      thin(28, 10, 27, 11);

      // rider
      const nearFoot = footAt(pose.crank);
      const nearKnee = kneeFor(nearFoot);
      thin(hip[0], hip[1], nearKnee[0], nearKnee[1]); // thigh
      thin(hip[0] + 1, hip[1], nearKnee[0] + 1, nearKnee[1]);
      thin(nearKnee[0], nearKnee[1], nearFoot[0], nearFoot[1]); // shin
      u(Math.round(nearFoot[0]) + 1, Math.round(nearFoot[1]));
      thin(hip[0], hip[1], shoulder[0], shoulder[1]); // torso
      thin(hip[0], hip[1] - 1, shoulder[0], shoulder[1] - 1);
      thin(shoulder[0], shoulder[1], 27, 8); // arm
      for (let y = Math.floor(headC[1] - 3); y <= Math.ceil(headC[1] + 3); y++) {
        for (let x = Math.floor(headC[0] - 3); x <= Math.ceil(headC[0] + 3); x++) {
          if (Math.hypot(x + 0.5 - headC[0], y + 0.5 - headC[1]) <= 2.0) u(x, y);
        }
      }
    }

    // ---------- Obstacles ----------
    function spawn() {
      const km = dist / PX_PER_KM;
      const roll = Math.random();
      let o;

      if (km > 0.15 && roll < 0.28) {
        const bottoms = [12, 46, 80]; // px above ground: jump / duck-or-jump / harmless
        const b = bottoms[Math.floor(Math.random() * bottoms.length)];
        o = { type: "gull", x: W + 10, w: 26, h: 12, y: GROUND - b - 12, vx: 70 };
      } else if (km > 0.05 && roll < 0.45) {
        o = { type: "hole", x: W + 10, w: 44, h: 0, y: GROUND };
      } else if (km > 0.03 && roll < 0.62) {
        o = { type: "car", x: W + 10, w: 56, h: 24, y: GROUND - 24 };
      } else {
        const n = 1 + Math.floor(Math.random() * (km > 0.1 ? 3 : 2));
        o = { type: "cone", n: n, x: W + 10, w: n * 14 + (n - 1) * 2, h: 20, y: GROUND - 20 };
      }
      obstacles.push(o);
      nextGap = o.w + speed * rand(0.8, 1.7);
      sinceSpawn = 0;
    }

    function drawCar(o) {
      const u = (x, y) => rect(o.x + x * P, o.y + y * P, P, P);
      // body
      for (let y = 5; y <= 8; y++) {
        for (let x = 0; x < 28; x++) {
          if ((y === 5 || y === 8) && (x === 0 || x === 27)) continue;
          u(x, y);
        }
      }
      // cabin with two windows
      for (let y = 0; y <= 4; y++) {
        for (let x = 9 - y; x <= 18 + y; x++) {
          const window1 = y >= 1 && x >= 9 && x <= 13;
          const window2 = y >= 1 && x >= 15 && x <= 19;
          if (!(window1 || window2) || y === 0) u(x, y);
        }
      }
      // wheels (rings so they read against the body)
      ctx.fillStyle = colors.fg;
      [6, 21].forEach((cx) => {
        for (let y = 6; y <= 11; y++) {
          for (let x = cx - 3; x <= cx + 3; x++) {
            const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - 9);
            if (d <= 2.9) u(x, y);
          }
        }
      });
      // hubcaps cut out of the wheels
      ctx.fillStyle = "#1e1f29";
      [6, 21].forEach((cx) => u(cx, 9));
      ctx.fillStyle = colors.fg;
    }

    function drawObstacle(o) {
      if (o.type === "cone") {
        for (let i = 0; i < o.n; i++) drawSprite(CONE, o.x + i * 16, o.y);
      } else if (o.type === "car") {
        drawCar(o);
      } else if (o.type === "gull") {
        drawSprite(GULL[Math.floor(time * 6) % 2], o.x, o.y);
      }
      // holes are drawn together with the ground
    }

    // ---------- Pose / hitbox ----------
    const BIKE_X = 40;
    function bikePose() {
      const tuck = ducking && onGround;
      return { wheel: wheelAngle, crank: crankAngle, tuck: tuck };
    }

    function bikeBox() {
      const tuck = ducking && onGround;
      const topUnits = tuck ? 4.2 : 0.2;
      const top = feetY - (26 - topUnits) * P + 3;
      return { x: BIKE_X + 8, y: top, w: 48, h: feetY - 2 - top };
    }

    function collides() {
      const b = bikeBox();
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.type === "hole") {
          // dies if a wheel is on the ground over the gap
          if (feetY >= GROUND - 3) {
            const rearHub = BIKE_X + 6 * P + P;
            const frontHub = BIKE_X + 26 * P + P;
            const lo = o.x + 4;
            const hi = o.x + o.w - 4;
            if ((rearHub > lo && rearHub < hi) || (frontHub > lo && frontHub < hi)) return true;
          }
          continue;
        }
        const ox = o.x + 3;
        const oy = o.y + 2;
        const ow = o.w - 6;
        const oh = o.h - 2;
        if (b.x < ox + ow && b.x + b.w > ox && b.y < oy + oh && b.y + b.h > oy) return true;
      }
      return false;
    }

    // ---------- Update & draw ----------
    function update(dt) {
      time += dt;

      if (state === "idle") return;

      // clouds and ground bumps keep moving while dead? No: freeze everything on death.
      if (state === "dead") return;

      speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
      const move = speed * dt;
      dist += move;

      if (!onGround) {
        vy += GRAVITY * (ducking ? 2.6 : 1) * dt;
        feetY += vy * dt;
        if (feetY >= GROUND) {
          feetY = GROUND;
          vy = 0;
          onGround = true;
        }
      }

      wheelAngle += move / 11;
      if (onGround) crankAngle += (move / 11) * 0.55;

      clouds.forEach((c) => {
        c.x -= 40 * dt;
        if (c.x < -50) {
          c.x = W + rand(10, 120);
          c.y = rand(18, 70);
        }
      });
      bumps.forEach((b) => {
        b.x -= move;
        if (b.x < -10) {
          b.x += W + 20 + rand(0, 40);
          b.y = Math.floor(rand(0, 3)) * 4;
          b.w = Math.random() < 0.5 ? 2 : 4;
        }
      });

      sinceSpawn += move;
      if (sinceSpawn >= nextGap) spawn();

      obstacles.forEach((o) => {
        o.x -= (speed + (o.vx || 0)) * dt;
      });
      obstacles = obstacles.filter((o) => o.x + o.w > -20);

      const tenth = Math.floor((dist / PX_PER_KM) * 10);
      if (tenth > lastTenth) {
        lastTenth = tenth;
        flash = 0.9;
      }
      if (flash > 0) flash -= dt;

      if (collides()) die();
    }

    function die() {
      state = "dead";
      deadAt = performance.now();
      const km = dist / PX_PER_KM;
      if (km > best) {
        best = km;
        saveBest(best);
      }
    }

    function drawGround() {
      ctx.fillStyle = colors.dim;
      const holes = obstacles.filter((o) => o.type === "hole").sort((a, b) => a.x - b.x);
      let x = 0;
      holes.forEach((h) => {
        if (h.x > x) rect(x, GROUND, h.x - x, 2);
        x = Math.max(x, h.x + h.w);
        rect(h.x, GROUND, 2, 10); // left wall of the hole
        rect(h.x + h.w - 2, GROUND, 2, 10); // right wall
      });
      if (x < W) rect(x, GROUND, W - x, 2);

      bumps.forEach((b) => {
        const inHole = holes.some((h) => b.x > h.x - 2 && b.x < h.x + h.w + 2);
        if (!inHole) rect(b.x, GROUND + 5 + b.y, b.w, 2);
      });
    }

    function drawHud() {
      const km = dist / PX_PER_KM;
      const sc = 2;
      const y = 10;
      const cur = formatKm(km);
      const hi = formatKm(best);
      const unit = "KM";
      const total = "HI " + hi + "  " + cur + " " + unit;
      let x = W - 12 - textWidth(total, sc);

      ctx.fillStyle = colors.dim;
      drawText("HI " + hi + "  ", x, y, sc);
      x += textWidth("HI " + hi + "  ", sc) + sc;
      if (!(flash > 0 && Math.floor(flash * 8) % 2 === 0)) {
        ctx.fillStyle = colors.fg;
        drawText(cur, x, y, sc);
      }
      x += textWidth(cur, sc) + sc * 2;
      ctx.fillStyle = colors.dim;
      drawText(unit, x, y, sc);
    }

    function drawRestartIcon(cx, cy) {
      ctx.fillStyle = colors.fg;
      const r = 6;
      for (let a = 0; a < Math.PI * 2; a += 0.12) {
        // leave a gap at the top-right for the arrow head
        if (a > 5.0 && a < 5.75) continue;
        const px = Math.round((cx + Math.cos(a) * r) / P) * P;
        const py = Math.round((cy + Math.sin(a) * r) / P) * P;
        rect(px, py, P, P);
      }
      // arrow head
      const ax = Math.round((cx + 4) / P) * P;
      const ay = Math.round((cy - 9) / P) * P;
      rect(ax, ay, P, P * 3);
      rect(ax + P, ay + P, P, P);
      rect(ax - P, ay, P * 3, P);
    }

    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = colors.dim;
      clouds.forEach((c) => drawSprite(CLOUD, c.x, c.y));

      drawGround();

      ctx.fillStyle = colors.fg;
      obstacles.forEach(drawObstacle);

      const pose = bikePose();
      drawBike(BIKE_X, feetY - 26 * P, pose);

      drawHud();

      if (state === "dead") {
        ctx.fillStyle = colors.fg;
        const t = "GAME OVER";
        drawText(t, Math.round((W - textWidth(t, 3)) / 2), 40, 3);
        drawRestartIcon(W / 2, 82);
      }
    }

    function frame(ts) {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
      lastTs = ts;
      update(dt);
      draw();
    }

    // ---------- Input ----------
    function pressJump() {
      if (state === "idle") {
        reset();
        state = "run";
      } else if (state === "dead") {
        if (performance.now() - deadAt < 350) return;
        reset();
        state = "run";
        return;
      }
      if (onGround) {
        vy = -JUMP_V;
        onGround = false;
      }
    }

    function onKeyDown(e) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (e.repeat && state !== "run") return;
        pressJump();
      } else if (e.key === "ArrowDown" || e.key === "s") {
        e.preventDefault();
        ducking = true;
      }
    }

    function onKeyUp(e) {
      if (e.key === "ArrowDown" || e.key === "s") ducking = false;
    }

    function onPointerDown(e) {
      e.preventDefault();
      const rectPx = canvas.getBoundingClientRect();
      const relY = (e.clientY - rectPx.top) / rectPx.height;
      if (state === "run" && relY > 0.65) {
        ducking = true;
      } else {
        pressJump();
      }
    }

    function onPointerUp() {
      ducking = false;
    }

    // ---------- Sizing ----------
    function resize() {
      const cssW = canvas.clientWidth;
      if (!cssW) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      scale = canvas.width / W;
      canvas.height = Math.round(H * scale);
      if (isOpen) draw();
    }

    let resizeObserver = null;

    // ---------- Public API ----------
    function open() {
      if (isOpen) return;
      isOpen = true;
      reset();
      state = "idle";
      resize();
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("keyup", onKeyUp);
      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
      }
      lastTs = performance.now();
      rafId = requestAnimationFrame(frame);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = null;
      if (typeof options.onExit === "function") options.onExit(best);
    }

    reset();

    return {
      open: open,
      close: close,
      isOpen: () => isOpen,
      getBest: () => best,
      formatKm: formatKm,
    };
  }

  window.createBikeGame = createBikeGame;
})();
