// Gold dust in pseudo-3D (canvas 2D): spirals out of the envelope, gathers into the S·P monogram,
// glitters, then bursts into blush petals. Halves the particle count on slow phones.
(function () {
  'use strict';

  var GATHER_MS = 1600;
  var HOLD_MS = 1000;
  var BURST_MS = 1500;
  var FOCAL = 520;            // perspective strength
  var GOLD = ['#FFF6DE', '#F6E3B0', '#E8C77E', '#D9AF6C', '#FFFFFF'];
  var PETALS = ['#F8DDD5', '#EAC2B8', '#E3A799', '#FFF4EF'];
  var PETAL_RATIO = 0.35;
  var SLOW_FRAME_MS = 26;
  var FRAME_MS = 1000 / 60;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // soft glowing dot, pre-rendered once per colour (much cheaper than shadowBlur)
  function sprite(color) {
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return c;
  }

  // points inside the monogram: a big script S with the P tucked lower-right, like the printed card
  function monogramPoints(size) {
    var w = Math.round(size);
    var h = Math.round(size * 0.92);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = Math.round(h * 0.82) + 'px "Great Vibes", cursive';
    g.fillText('S', w * 0.4, h * 0.66);
    g.fillText('P', w * 0.62, h * 0.84);
    var data = g.getImageData(0, 0, w, h).data;
    var step = Math.max(2, Math.round(w / 140));
    var pts = [];
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 140) pts.push([x - w / 2, y - h / 2]);
      }
    }
    return pts.length ? pts : [[0, 0]];
  }

  function play(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var W = window.innerWidth;
    var H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var center = { x: W / 2, y: H * 0.45 };
    var origin = opts.origin || center;
    var pts = monogramPoints(Math.min(W * 0.78, 400));
    var sprites = GOLD.map(sprite);
    var count = W < 600 ? 950 : 1500;
    var particles = [];
    for (var i = 0; i < count; i++) {
      var target = pick(pts);
      particles.push({
        tx: target[0] + rand(-1.2, 1.2), ty: target[1] + rand(-1.2, 1.2), tz: rand(-26, 26),
        sx: origin.x - center.x + rand(-40, 40), sy: origin.y - center.y + rand(-24, 24), sz: rand(-30, 30),
        swirl: rand(70, 210), angle: rand(0, Math.PI * 2), spin: rand(4, 7) * (Math.random() < 0.5 ? -1 : 1),
        delay: rand(0, 380), size: rand(1.3, 3.4), sprite: sprites[i % sprites.length], twinkle: rand(0, 6.3),
        petal: Math.random() < PETAL_RATIO, petalColor: pick(PETALS),
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: rand(0, 6.3), vr: rand(-0.12, 0.12)
      });
    }

    var start = performance.now();
    var last = start;
    var raf = 0;
    var stopped = false;
    var formed = false;
    var bursting = false;
    var slowFrames = 0;
    var frames = 0;
    var resolveDone;
    var done = new Promise(function (resolve) { resolveDone = resolve; });

    function project(x, y, z, rotY) {
      var c = Math.cos(rotY);
      var s = Math.sin(rotY);
      var X = x * c - z * s;
      var Z = x * s + z * c;
      var k = FOCAL / (FOCAL + Z);
      return { x: center.x + X * k, y: center.y + y * k, k: k };
    }

    function finish() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, W, H);
      resolveDone();
    }

    function startBurst() {
      particles.forEach(function (p) {
        var len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1;
        var speed = rand(2.5, 9) * (p.petal ? 0.7 : 1);
        p.vx = p.x / len * speed + rand(-1, 1);
        p.vy = p.y / len * speed - rand(1.5, 4);
        p.vz = p.z / len * speed;
      });
    }

    function step(now) {
      if (stopped) return;
      var t = now - start;
      var dt = now - last;
      var f = Math.min(3, dt / FRAME_MS);
      last = now;

      // slow phone: drop half the particles once, early on
      frames += 1;
      if (frames > 5 && frames < 40 && dt > SLOW_FRAME_MS && particles.length > 400 && ++slowFrames > 6) {
        particles = particles.filter(function (p, idx) { return idx % 2 === 0; });
        slowFrames = 0;
      }

      var holdEnd = GATHER_MS + HOLD_MS;
      if (!formed && t >= GATHER_MS) { formed = true; if (opts.onFormed) opts.onFormed(); }
      if (!bursting && t >= holdEnd) { bursting = true; startBurst(); if (opts.onBurst) opts.onBurst(); }
      if (t >= holdEnd + BURST_MS) { finish(); return; }

      ctx.clearRect(0, 0, W, H);
      var rotY = t < GATHER_MS ? (1 - easeOut(t / GATHER_MS)) * 1.6 : Math.sin((t - GATHER_MS) / 520) * 0.22;
      var burstT = bursting ? (t - holdEnd) / BURST_MS : 0;
      var fadeIn = Math.min(1, t / 250);

      // pass 1: gold dust (additive glow)
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var alpha;
        if (!bursting) {
          var e = easeInOut(clamp01((t - p.delay) / (GATHER_MS - 200)));
          var r = p.swirl * Math.sin(Math.PI * e);           // spiral opens, then closes on the target
          var ang = p.angle + p.spin * e;
          p.x = p.sx + (p.tx - p.sx) * e + Math.cos(ang) * r;
          p.y = p.sy + (p.ty - p.sy) * e + Math.sin(ang) * r * 0.3;
          p.z = p.sz + (p.tz - p.sz) * e + Math.sin(ang) * r;
          alpha = fadeIn * (formed ? 0.72 + 0.28 * Math.sin(t * 0.012 + p.twinkle) : 0.9);
        } else {
          p.vy += 0.07 * f;
          p.vx *= Math.pow(0.985, f);
          p.vz *= Math.pow(0.985, f);
          p.x += p.vx * f; p.y += p.vy * f; p.z += p.vz * f;
          p.rot += p.vr * f;
          if (p.petal) continue;
          alpha = 1 - Math.pow(burstT, 1.4);
        }
        var q = project(p.x, p.y, p.z, rotY);
        var glow = formed && !bursting ? 1 + 0.35 * Math.sin(t * 0.02 + p.twinkle) : 1;
        var s = p.size * q.k * glow * 2.2;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha * q.k));
        ctx.drawImage(p.sprite, q.x - s, q.y - s, s * 2, s * 2);
      }

      // pass 2: blush petals flying out of the burst
      if (bursting) {
        ctx.globalCompositeOperation = 'source-over';
        var petalAlpha = 1 - Math.pow(burstT, 3);
        for (var j = 0; j < particles.length; j++) {
          var pt = particles[j];
          if (!pt.petal) continue;
          var pq = project(pt.x, pt.y, pt.z, rotY);
          ctx.save();
          ctx.translate(pq.x, pq.y);
          ctx.rotate(pt.rot);
          ctx.globalAlpha = Math.max(0, petalAlpha * Math.min(1, pq.k));
          ctx.fillStyle = pt.petalColor;
          ctx.beginPath();
          ctx.ellipse(0, 0, 5.5 * pq.k * pt.size / 2.4, 3.4 * pq.k * pt.size / 2.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);
    return { done: done, stop: finish };
  }

  window.EcardParticles = { play: play };
})();
