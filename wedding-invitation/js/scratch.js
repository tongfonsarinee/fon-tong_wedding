// Scratch-to-reveal gold foil (canvas) over the "22" artwork; fires 'ecard:burst' once everything is open
(function () {
  'use strict';

  var BRUSH_RADIUS = 22;
  var REVEAL_THRESHOLD = 0.45;
  var SAMPLE_STEP = 6; // check every Nth pixel when measuring cleared area
  var CHECK_EVERY_MOVES = 8;
  var GLITTER_COUNT = 260;
  var FONT_WAIT_MS = 3000;

  var row = document.getElementById('scratch-row');
  var skipBtn = document.getElementById('scratch-skip');
  var block = document.getElementById('std');
  if (!row) return;

  var cards = Array.prototype.slice.call(row.querySelectorAll('.scratch'));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // champagne-gold foil with fine diagonal brushing, glitter and a label
  function paintCover(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#B0803F');
    grad.addColorStop(0.22, '#E8D19B');
    grad.addColorStop(0.4, '#FFF4D8');
    grad.addColorStop(0.58, '#CFA35D');
    grad.addColorStop(0.78, '#EBD5A2');
    grad.addColorStop(1, '#A8783A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // brushed-metal streaks
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    for (var x = -h; x < w; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
      ctx.stroke();
    }
    ctx.restore();

    // glitter
    for (var i = 0; i < GLITTER_COUNT; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + Math.random() * 0.65).toFixed(2) + ')';
      var s = Math.random() < 0.15 ? 2.2 : 1.2;
      ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
    }

    // label: heart, Thai hint, small caps
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(90, 42, 20, .78)';
    ctx.font = '30px "Great Vibes", cursive';
    ctx.fillText('Save the Date', w / 2, h / 2 - 16);
    ctx.font = '400 16px "IBM Plex Sans Thai Looped", sans-serif';
    ctx.fillText('♡  ขูดตรงนี้  ♡', w / 2, h / 2 + 18);
    ctx.font = '500 10px Cinzel, serif';
    ctx.fillStyle = 'rgba(90, 42, 20, .55)';
    ctx.fillText('S C R A T C H   T O   R E V E A L', w / 2, h / 2 + 42);

    ctx.globalCompositeOperation = 'destination-out';
    return ctx;
  }

  function clearedRatio(ctx, canvas) {
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var total = 0;
    var clear = 0;
    for (var i = 3; i < data.length; i += 4 * SAMPLE_STEP) {
      total += 1;
      if (data[i] === 0) clear += 1;
    }
    return total ? clear / total : 1;
  }

  function allRevealed() {
    return cards.every(function (c) { return c.classList.contains('is-revealed'); });
  }

  function celebrate() {
    if (skipBtn) skipBtn.hidden = true;
    if (block) block.classList.add('is-revealed');
    var rect = row.getBoundingClientRect();
    document.dispatchEvent(new CustomEvent('ecard:burst', {
      detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, count: 18, confetti: 40 }
    }));
  }

  function reveal(card) {
    if (card.classList.contains('is-revealed')) return;
    card.classList.add('is-revealed');
    if (allRevealed()) celebrate();
  }

  function setupCard(card) {
    var canvas = card.querySelector('canvas');
    var ctx = canvas && paintCover(canvas);
    if (!ctx) { reveal(card); return; }

    var drawing = false;
    var moves = 0;
    var last = null;

    function point(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function scratchTo(p) {
      ctx.beginPath();
      if (last) {
        ctx.lineWidth = BRUSH_RADIUS * 2;
        ctx.lineCap = 'round';
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.arc(p.x, p.y, BRUSH_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      last = p;
      moves += 1;
      if (moves % CHECK_EVERY_MOVES === 0 && clearedRatio(ctx, canvas) >= REVEAL_THRESHOLD) reveal(card);
    }

    canvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      last = null;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      scratchTo(point(e));
    });
    canvas.addEventListener('pointermove', function (e) {
      if (drawing) scratchTo(point(e));
    });
    function stop() {
      if (!drawing) return;
      drawing = false;
      last = null;
      if (clearedRatio(ctx, canvas) >= REVEAL_THRESHOLD) reveal(card);
    }
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  function init() {
    if (reduceMotion) { cards.forEach(reveal); return; }
    cards.forEach(setupCard);
    if (skipBtn) skipBtn.addEventListener('click', function () { cards.forEach(reveal); });
  }

  // Wait for the faces the foil label is drawn in (canvas text never re-renders on font load)
  if (document.fonts && document.fonts.load) {
    var giveUp = new Promise(function (resolve) { setTimeout(resolve, FONT_WAIT_MS); }); // slow network: paint anyway
    Promise.race([Promise.all([
      document.fonts.load('30px "Great Vibes"'),
      document.fonts.load('400 16px "IBM Plex Sans Thai Looped"', 'ขูดตรงนี้'),
      document.fonts.load('500 10px Cinzel')
    ]), giveUp]).then(init, init);
  } else {
    init();
  }
})();
