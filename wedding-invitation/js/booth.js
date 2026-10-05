// Photo booth: the front camera (or a photo from the phone) composed into the wedding frame
// — a background the guest picks (THEMES), gold double arch, a tilted polaroid of the bride & groom,
// names in script — then saved or shared (LINE / IG).
(function () {
  'use strict';

  var OUT_W = 1080;                 // 4:5 portrait, friendly for LINE / Instagram
  var OUT_H = 1350;
  var LIVE_SCALE = 0.5;             // the live preview renders at half size
  var WIN = { x: 80, y: 80, w: 920, h: 1000, r: 26 }; // arch window for the guest's photo
  var POLAROID = { cx: 840, cy: 850, w: 300, h: 380, tilt: 5 }; // the couple, tucked into the corner
  var COUNTDOWN = 3;
  var FILE_NAME = 'ฝน-โต้ง-22.11.2569.jpg';
  var JPEG_QUALITY = 0.92;
  var FONT_WAIT_MS = 3000;
  // frame backgrounds the guest can choose; dark ones switch the lettering to light gold
  var THEMES = [
    { id: 'ivory', label: 'ครีม', swatch: '#FFF9F3', paper: ['#FFFBF6', '#FFF1EA'] },
    { id: 'blush', label: 'ชมพู', swatch: '#F0C9BE', paper: ['#FCE9E3', '#EDBFB2'] },
    { id: 'petals', label: 'กลีบกุหลาบ', swatch: 'radial-gradient(circle at 30% 30%, #E59D8E 0 18%, transparent 20%), radial-gradient(circle at 70% 65%, #F2C4B8 0 16%, transparent 18%), #FFF4EF', paper: ['#FFF8F5', '#F8E1DA'], decor: 'petals' },
    { id: 'champagne', label: 'แชมเปญ', swatch: 'linear-gradient(135deg, #B0803F, #FFF3CC 50%, #CFA35D)', paper: ['#F6E7C3', '#DDBD7E'], decor: 'foil' },
    { id: 'cocoa', label: 'ช็อกโกแลต', swatch: 'radial-gradient(circle at 35% 30%, #7A3A1E, #2A1209)', paper: ['#5E2C15', '#2A1209'], decor: 'dust', dark: true },
    { id: 'night', label: 'คืนโคมลอย', swatch: 'linear-gradient(180deg, #160C20, #5A2A14)', paper: ['#120A1A', '#4A2414'], decor: 'night', dark: true }
  ];

  var section = document.getElementById('booth');
  var modal = document.getElementById('booth-modal');
  if (!section || !modal) return;

  var demo = section.querySelector('.booth__preview canvas');
  // ฝน & โต้ง for the polaroid: a data URI (js/booth-photo.js) so the canvas stays exportable even from file://
  var couplePhoto = new Image();
  couplePhoto.src = window.BOOTH_COUPLE_PHOTO || 'assets/couple/002-s.jpg';
  var cameraBtn = document.getElementById('booth-camera');
  var fileInput = document.getElementById('booth-file');
  var live = document.getElementById('booth-live');
  var video = document.getElementById('booth-video');
  var result = document.getElementById('booth-result');
  var countEl = document.getElementById('booth-count');
  var flash = modal.querySelector('.booth-modal__flash');
  var liveBar = modal.querySelector('.booth-modal__bar--live');
  var resultBar = modal.querySelector('.booth-modal__bar--result');
  var saveLink = document.getElementById('booth-save');
  var shareBtn = document.getElementById('booth-share');

  var stream = null;
  var facing = 'user';
  var raf = 0;
  var resultUrl = null;
  var resultFile = null;
  var busy = false;
  var theme = THEMES[0];
  var lastShot = null; // { src, w, h, mirror } — re-rendered when the guest changes the background

  function toast(msg) { if (window.EcardToast) window.EcardToast(msg); }
  function sfx(name) { if (window.EcardAudio) window.EcardAudio.sfx(name); }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var giveUp = new Promise(function (resolve) { setTimeout(resolve, FONT_WAIT_MS); });
    return Promise.race([Promise.all([
      document.fonts.load('96px "Great Vibes"'),
      document.fonts.load('500 28px Cinzel'),
      document.fonts.load('500 30px "IBM Plex Sans Thai Looped"', 'ฝน โต้ง รูปเซลฟีของคุณ')
    ]), giveUp]);
  }

  /* ----- Drawing ----- */
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // petals stay in the margins and top corners so they never cover the names
  function inMargin(x, y) {
    return y < 260 || x < 70 || x > OUT_W - 70 || (y > 1110 && (x < 190 || x > OUT_W - 190));
  }

  function drawPetal(g, x, y, rx, ry, angle, color, alpha) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = alpha * 0.6;
    g.strokeStyle = 'rgba(255, 255, 255, .7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-rx * 0.6, 0);
    g.quadraticCurveTo(0, -ry * 0.4, rx * 0.6, 0);
    g.stroke();
    g.restore();
  }

  function drawLantern(g, x, y, s) {
    var glow = g.createRadialGradient(x, y, 2, x, y, 60 * s);
    glow.addColorStop(0, 'rgba(255, 190, 110, .45)');
    glow.addColorStop(1, 'rgba(255, 150, 70, 0)');
    g.fillStyle = glow;
    g.fillRect(x - 60 * s, y - 60 * s, 120 * s, 120 * s);
    var body = g.createRadialGradient(x, y + 10 * s, 2, x, y, 30 * s);
    body.addColorStop(0, '#FFF6D0');
    body.addColorStop(0.45, '#FFC46B');
    body.addColorStop(1, '#C2541F');
    g.fillStyle = body;
    roundRect(g, x - 14 * s, y - 19 * s, 28 * s, 38 * s, 10 * s);
    g.fill();
  }

  function background(g) {
    var paper = g.createLinearGradient(0, 0, 0, OUT_H);
    paper.addColorStop(0, theme.paper[0]);
    paper.addColorStop(1, theme.paper[1]);
    g.fillStyle = paper;
    g.fillRect(0, 0, OUT_W, OUT_H);
    var rand = seeded(22112026);
    var i;

    if (theme.decor === 'petals') {
      var colors = ['#F2C4B8', '#EAB0A2', '#F8DDD5', '#E59D8E'];
      for (i = 0; i < 46;) {
        var px = rand() * OUT_W;
        var py = rand() * OUT_H;
        if (!inMargin(px, py)) continue;
        drawPetal(g, px, py, 14 + rand() * 14, 9 + rand() * 7, rand() * Math.PI, colors[i % colors.length], 0.55 + rand() * 0.4);
        i += 1;
      }
    } else if (theme.decor === 'foil') {
      g.save();
      g.globalAlpha = 0.12;
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 1.2;
      for (i = -OUT_H; i < OUT_W; i += 7) {
        g.beginPath();
        g.moveTo(i, OUT_H);
        g.lineTo(i + OUT_H, 0);
        g.stroke();
      }
      g.restore();
      var sheen = g.createLinearGradient(0, 0, OUT_W, OUT_H);
      sheen.addColorStop(0.2, 'rgba(255, 255, 255, 0)');
      sheen.addColorStop(0.45, 'rgba(255, 250, 230, .55)');
      sheen.addColorStop(0.7, 'rgba(255, 255, 255, 0)');
      g.fillStyle = sheen;
      g.fillRect(0, 0, OUT_W, OUT_H);
    } else if (theme.decor === 'dust') {
      var halo = g.createRadialGradient(OUT_W / 2, 0, 40, OUT_W / 2, 0, OUT_H * 0.8);
      halo.addColorStop(0, 'rgba(201, 132, 118, .35)');
      halo.addColorStop(1, 'rgba(201, 132, 118, 0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, OUT_W, OUT_H);
      for (i = 0; i < 170; i++) {
        g.globalAlpha = 0.3 + rand() * 0.7;
        g.fillStyle = rand() < 0.5 ? '#F6DCA0' : '#FFF4DA';
        g.beginPath();
        g.arc(rand() * OUT_W, rand() * OUT_H, 0.8 + rand() * 2.4, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    } else if (theme.decor === 'night') {
      for (i = 0; i < 120; i++) {
        g.globalAlpha = 0.35 + rand() * 0.65;
        g.fillStyle = '#FFFFFF';
        g.beginPath();
        g.arc(rand() * OUT_W, rand() * OUT_H * 0.8, 0.7 + rand() * 1.8, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      var moonGlow = g.createRadialGradient(972, 120, 30, 972, 120, 130);
      moonGlow.addColorStop(0, 'rgba(255, 236, 190, .45)');
      moonGlow.addColorStop(1, 'rgba(255, 236, 190, 0)');
      g.fillStyle = moonGlow;
      g.fillRect(842, 0, 238, 250);
      g.fillStyle = '#FFF4D6';
      g.beginPath();
      g.arc(972, 120, 40, 0, Math.PI * 2);
      g.fill();
      drawLantern(g, 120, 150, 1);
      drawLantern(g, 52, 330, 0.75);
      drawLantern(g, 230, 70, 0.6);
      drawLantern(g, 1030, 330, 0.8);
      drawLantern(g, 120, 1200, 0.7);
      drawLantern(g, 960, 1215, 0.85);
    } else {
      var glow = g.createRadialGradient(OUT_W / 2, OUT_H, 40, OUT_W / 2, OUT_H, OUT_H * 0.7);
      glow.addColorStop(0, theme.id === 'blush' ? 'rgba(255, 255, 255, .5)' : 'rgba(241, 208, 199, .65)');
      glow.addColorStop(1, 'rgba(241, 208, 199, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, OUT_W, OUT_H);
    }
  }
  function archPath(g, x, y, w, h, r) {
    var rad = w / 2;
    g.beginPath();
    g.moveTo(x, y + rad);
    g.arc(x + rad, y + rad, rad, Math.PI, 0);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.closePath();
  }

  function gradient(g, stops) {
    var grad = g.createLinearGradient(WIN.x, 0, WIN.x + WIN.w, 0);
    stops.forEach(function (c, i) { grad.addColorStop(i / (stops.length - 1), c); });
    return grad;
  }

  function star(g, cx, cy, r) {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.quadraticCurveTo(cx, cy, cx + r, cy);
    g.quadraticCurveTo(cx, cy, cx, cy + r);
    g.quadraticCurveTo(cx, cy, cx - r, cy);
    g.quadraticCurveTo(cx, cy, cx, cy - r);
    g.fill();
  }

  function heart(g, cx, cy, s) {
    g.beginPath();
    g.moveTo(cx, cy + s * 0.9);
    g.bezierCurveTo(cx - s * 1.3, cy + s * 0.1, cx - s * 0.9, cy - s * 0.9, cx, cy - s * 0.35);
    g.bezierCurveTo(cx + s * 0.9, cy - s * 0.9, cx + s * 1.3, cy + s * 0.1, cx, cy + s * 0.9);
    g.fill();
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function coverFit(g, img, x, y, w, h, biasY) {
    var iw = img.naturalWidth || img.videoWidth || img.width;
    var ih = img.naturalHeight || img.videoHeight || img.height;
    var scale = Math.max(w / iw, h / ih);
    g.drawImage(img, x + (w - iw * scale) / 2, y + (h - ih * scale) * biasY, iw * scale, ih * scale);
  }

  // preview only: where the guest's selfie will go
  function placeholder(g) {
    var bg = g.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h);
    bg.addColorStop(0, '#FBEAE4');
    bg.addColorStop(1, '#EEC5BA');
    g.fillStyle = bg;
    g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    g.fillStyle = 'rgba(201, 132, 118, .38)';
    [[420, 520, 1], [640, 545, 0.92]].forEach(function (p) {
      g.beginPath();
      g.arc(p[0], p[1], 72 * p[2], 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(p[0], p[1] + 270 * p[2], 150 * p[2], 160 * p[2], 0, Math.PI, 0);
      g.fill();
    });
    g.fillStyle = 'rgba(125, 56, 24, .6)';
    g.textAlign = 'center';
    g.font = '500 42px "IBM Plex Sans Thai Looped", sans-serif';
    g.fillText('รูปเซลฟีของคุณ', OUT_W / 2, 330);
  }

  // ฝน & โต้ง as a tilted polaroid with an arch-cut photo
  function polaroid(g, gold) {
    if (!couplePhoto || !couplePhoto.naturalWidth) return;
    var P = POLAROID;
    var pw = P.w - 32;
    var ph = P.h - 96;
    g.save();
    g.translate(P.cx, P.cy);
    g.rotate(P.tilt * Math.PI / 180);
    g.shadowColor = 'rgba(74, 36, 20, .45)';
    g.shadowBlur = 34;
    g.shadowOffsetY = 14;
    g.fillStyle = '#FFFBF6';
    roundRect(g, -P.w / 2, -P.h / 2, P.w, P.h, 10);
    g.fill();
    g.shadowColor = 'transparent';
    g.save();
    archPath(g, -pw / 2, -P.h / 2 + 16, pw, ph, 8);
    g.clip();
    coverFit(g, couplePhoto, -pw / 2, -P.h / 2 + 16, pw, ph, 0.2);
    g.restore();
    g.strokeStyle = gold;
    g.lineWidth = 3;
    archPath(g, -pw / 2, -P.h / 2 + 16, pw, ph, 8);
    g.stroke();
    g.fillStyle = '#7D3818';
    g.textAlign = 'center';
    g.font = '500 32px "IBM Plex Sans Thai Looped", sans-serif';
    g.fillText('ฝน ♡ โต้ง', 0, P.h / 2 - 32);
    g.restore();
  }

  // the full frame at OUT_W × OUT_H (callers scale the context for previews); no source = preview placeholder
  function compose(g, source, sw, sh, mirror) {
    var gold = gradient(g, ['#B0803F', '#E8CF95', '#FFF6DE', '#CFA35D', '#A8783A']);
    var ink = theme.dark
      ? gradient(g, ['#C79C55', '#F6E3B0', '#FFF8E6', '#D8B06A', '#B0803F'])
      : gradient(g, ['#6E2F12', '#A8693A', '#D9AF6C', '#A8693A', '#6E2F12']);

    background(g);

    // photo inside the arch (cover-fit, biased upward so faces stay in frame)
    g.save();
    archPath(g, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r);
    g.clip();
    g.fillStyle = '#F1D0C7';
    g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    if (!source) placeholder(g);
    if (source && sw && sh) {
      var scale = Math.max(WIN.w / sw, WIN.h / sh);
      var dw = sw * scale;
      var dh = sh * scale;
      if (mirror) {
        g.translate(WIN.x * 2 + WIN.w, 0);
        g.scale(-1, 1);
      }
      g.drawImage(source, WIN.x + (WIN.w - dw) / 2, WIN.y + (WIN.h - dh) * 0.35, dw, dh);
    }
    g.restore();

    // double gold arch
    g.strokeStyle = gold;
    g.lineWidth = 4;
    archPath(g, WIN.x - 16, WIN.y - 16, WIN.w + 32, WIN.h + 32, WIN.r + 10);
    g.stroke();
    g.globalAlpha = 0.5;
    g.lineWidth = 2;
    archPath(g, WIN.x - 30, WIN.y - 30, WIN.w + 60, WIN.h + 60, WIN.r + 20);
    g.stroke();
    g.globalAlpha = 1;

    polaroid(g, gold);

    // heart medallion at the top of the arch
    g.fillStyle = theme.paper[0];
    g.beginPath();
    g.arc(OUT_W / 2, WIN.y - 23, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = gold;
    heart(g, OUT_W / 2, WIN.y - 23, 14);

    // gold sparkles on the shoulders of the arch
    g.fillStyle = gold;
    star(g, WIN.x + 40, WIN.y + 190, 16);
    star(g, WIN.x + 82, WIN.y + 120, 9);
    star(g, WIN.x + WIN.w - 40, WIN.y + 190, 16);
    star(g, WIN.x + WIN.w - 82, WIN.y + 120, 9);

    // names + date
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = ink;
    g.font = '96px "Great Vibes", cursive';
    g.fillText('Sarinee & Pongsawat', OUT_W / 2, 1218);
    g.fillStyle = theme.dark ? '#E6CF9E' : '#9A7038';
    g.font = '500 28px Cinzel, serif';
    g.fillText('2 2  ·  1 1  ·  2 0 2 6     R O I   E T', OUT_W / 2, 1284);
    g.fillStyle = gold;
    g.fillRect(OUT_W / 2 - 330, 1275, 70, 2);
    g.fillRect(OUT_W / 2 + 260, 1275, 70, 2);
  }

  function drawDemo() {
    if (!demo) return;
    var g = demo.getContext('2d');
    var s = demo.width / OUT_W;
    g.setTransform(s, 0, 0, s, 0, 0);
    compose(g, null);
  }

  /* ----- Modal states ----- */
  function openModal() {
    modal.hidden = false;
    document.body.classList.add('is-locked');
  }

  function stopStream() {
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
  }

  function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    resultFile = null;
  }

  function closeModal() {
    stopStream();
    clearResult();
    modal.hidden = true;
    document.body.classList.remove('is-locked');
  }

  function showLive() {
    clearResult();
    result.hidden = true;
    live.hidden = false;
    liveBar.hidden = false;
    resultBar.hidden = true;
  }

  function showResult(blob) {
    clearResult();
    resultFile = new File([blob], FILE_NAME, { type: 'image/jpeg' });
    resultUrl = URL.createObjectURL(blob);
    result.src = resultUrl;
    result.hidden = false;
    live.hidden = true;
    liveBar.hidden = true;
    resultBar.hidden = false;
    saveLink.href = resultUrl;
    saveLink.download = FILE_NAME;
    shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [resultFile] }));
  }

  function render(source, sw, sh, mirror) {
    var canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    compose(canvas.getContext('2d'), source, sw, sh, mirror);
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('empty')); }, 'image/jpeg', JPEG_QUALITY);
      } catch (err) {
        reject(err); // e.g. a tainted canvas
      }
    });
  }

  /* ----- Camera ----- */
  function liveLoop() {
    var g = live.getContext('2d');
    g.setTransform(LIVE_SCALE, 0, 0, LIVE_SCALE, 0, 0);
    compose(g, video, video.videoWidth, video.videoHeight, facing === 'user');
    raf = requestAnimationFrame(liveLoop);
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('เบราว์เซอร์นี้เปิดกล้องไม่ได้ ลองเลือกรูปจากเครื่องแทน');
      return;
    }
    stopStream();
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false
    }).then(function (s) {
      stream = s;
      video.srcObject = s;
      return video.play();
    }).then(function () {
      live.width = OUT_W * LIVE_SCALE;
      live.height = OUT_H * LIVE_SCALE;
      openModal();
      showLive();
      liveLoop();
    }).catch(function () {
      stopStream();
      toast('เปิดกล้องไม่ได้ ลองอนุญาตกล้อง หรือเลือกรูปจากเครื่องแทน');
    });
  }

  function shoot() {
    if (busy || !stream) return;
    busy = true;
    var n = COUNTDOWN;
    function tick() {
      if (n > 0) {
        countEl.textContent = n;
        countEl.classList.remove('is-tick');
        void countEl.offsetWidth;
        countEl.classList.add('is-tick');
        sfx('beep');
        n -= 1;
        setTimeout(tick, 800);
        return;
      }
      countEl.textContent = '';
      flash.classList.remove('is-on');
      void flash.offsetWidth;
      flash.classList.add('is-on');
      sfx('shutter');
      if (window.EcardAudio) window.EcardAudio.buzz(25);
      var snap = document.createElement('canvas');
      snap.width = video.videoWidth;
      snap.height = video.videoHeight;
      snap.getContext('2d').drawImage(video, 0, 0);
      lastShot = { src: snap, w: snap.width, h: snap.height, mirror: facing === 'user' };
      render(snap, snap.width, snap.height, lastShot.mirror).then(function (blob) {
        cancelAnimationFrame(raf);
        showResult(blob);
      }).catch(function () {
        toast('บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
      }).then(function () { busy = false; });
    }
    tick();
  }

  /* ----- Photo from the phone ----- */
  function fromFile(file) {
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      lastShot = { src: img, w: img.naturalWidth, h: img.naturalHeight, mirror: false };
      fontsReady().then(function () {
        return render(img, img.naturalWidth, img.naturalHeight, false);
      }).then(function (blob) {
        stopStream();
        openModal();
        showResult(blob);
      }).catch(function () {
        toast('สร้างรูปไม่สำเร็จ ลองรูปอื่นนะ');
      });
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('เปิดรูปนี้ไม่ได้ ลองรูปอื่นนะ');
    };
    img.src = url;
  }

  /* ----- Background picker (preview + inside the camera) ----- */
  var pickers = Array.prototype.slice.call(document.querySelectorAll('.booth__themes, .booth-modal__themes'));

  function markChosen() {
    pickers.forEach(function (box) {
      Array.prototype.forEach.call(box.children, function (chip) {
        chip.setAttribute('aria-checked', String(chip.dataset.theme === theme.id));
      });
    });
  }

  function choose(id) {
    theme = THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0];
    markChosen();
    drawDemo();
    if (window.EcardAudio) window.EcardAudio.sfx('pop');
    // a finished photo is re-made with the new background
    if (!modal.hidden && !result.hidden && lastShot) {
      render(lastShot.src, lastShot.w, lastShot.h, lastShot.mirror).then(showResult).catch(function () {});
    }
  }

  pickers.forEach(function (box) {
    THEMES.forEach(function (t) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'theme-chip';
      chip.dataset.theme = t.id;
      chip.setAttribute('role', 'radio');
      chip.innerHTML = '<span></span>';
      chip.firstChild.style.background = t.swatch;
      chip.appendChild(document.createTextNode(t.label));
      chip.addEventListener('click', function () { choose(t.id); });
      box.appendChild(chip);
    });
  });
  markChosen();

  /* ----- Wiring ----- */
  cameraBtn.addEventListener('click', function () { fontsReady().then(startCamera); });
  fileInput.addEventListener('change', function () {
    fromFile(fileInput.files && fileInput.files[0]);
    fileInput.value = '';
  });
  modal.addEventListener('click', function (e) {
    var action = e.target.closest('[data-booth]');
    if (!action) return;
    switch (action.dataset.booth) {
      case 'close': closeModal(); break;
      case 'shoot': shoot(); break;
      case 'flip': facing = facing === 'user' ? 'environment' : 'user'; startCamera(); break;
      case 'retake':
        lastShot = null;
        if (stream) { showLive(); liveLoop(); } else { fileInput.click(); }
        break;
      case 'share':
        if (resultFile && navigator.share) {
          navigator.share({ files: [resultFile], title: 'ฝน & โต้ง · 22.11.2569', text: 'ร่วมยินดีกับฝนและโต้ง 💍' }).catch(function () {});
        }
        break;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  if (couplePhoto) {
    var paint = function () { fontsReady().then(drawDemo); };
    if (couplePhoto.complete && couplePhoto.naturalWidth) paint(); else couplePhoto.addEventListener('load', paint);
  }
})();
