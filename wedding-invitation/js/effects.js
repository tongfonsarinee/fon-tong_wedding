// Decorative effects: tap hearts, heart + confetti bursts ('ecard:burst' from intro.js / scratch.js)
(function () {
  'use strict';

  var MAX_HEARTS = 40;
  var MAX_CONFETTI = 80;
  var HEARTS_PER_TAP = 4;
  var TAP_MAX_MOVE_PX = 10;
  var TAP_MAX_MS = 500;
  var HEART_COLORS = ['#C98476', '#E3A799', '#EAC2B8', '#BE975E', '#D9B676'];
  var CONFETTI_COLORS = ['#E8D19B', '#FFF4D8', '#CFA35D', '#EAC2B8', '#F8E3DD', '#C98476', '#FFFFFF'];
  // Taps on these elements should do their own job, not spawn hearts
  var NO_HEART_SELECTOR = 'a, button, canvas, input, iframe, .lightbox, .dock, .intro';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var liveHearts = 0;
  var liveConfetti = 0;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function removeOnEnd(el, onDone) {
    el.addEventListener('animationend', function () {
      el.remove();
      onDone();
    });
    document.body.appendChild(el);
  }

  /* ----- Hearts ----- */
  function spawnHeart(x, y, spread) {
    if (liveHearts >= MAX_HEARTS) return;
    var el = document.createElement('span');
    el.className = 'heart';
    el.textContent = '♥';
    el.setAttribute('aria-hidden', 'true');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--size', rand(12, 22).toFixed(0) + 'px');
    el.style.setProperty('--color', pick(HEART_COLORS));
    el.style.setProperty('--dx', rand(-spread, spread).toFixed(0) + 'px');
    el.style.setProperty('--dy', rand(60, 140).toFixed(0) + 'px');
    el.style.setProperty('--rot', rand(-25, 25).toFixed(0) + 'deg');
    el.style.setProperty('--dur', rand(0.9, 1.5).toFixed(2) + 's');
    liveHearts += 1;
    removeOnEnd(el, function () { liveHearts -= 1; });
  }

  /* ----- Confetti ----- */
  function spawnConfetti(x, y) {
    if (liveConfetti >= MAX_CONFETTI) return;
    var el = document.createElement('span');
    el.className = 'confetti';
    el.setAttribute('aria-hidden', 'true');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    var long = rand(8, 14);
    el.style.setProperty('--w', (Math.random() < 0.3 ? long : rand(5, 8)).toFixed(1) + 'px');
    el.style.setProperty('--h', (Math.random() < 0.3 ? rand(5, 8) : long).toFixed(1) + 'px');
    el.style.setProperty('--color', pick(CONFETTI_COLORS));
    el.style.setProperty('--dx', rand(-170, 170).toFixed(0) + 'px');
    el.style.setProperty('--up', rand(90, 220).toFixed(0) + 'px');
    el.style.setProperty('--down', rand(120, 320).toFixed(0) + 'px');
    el.style.setProperty('--spin', rand(-720, 720).toFixed(0) + 'deg');
    el.style.setProperty('--dur', rand(1.3, 2.2).toFixed(2) + 's');
    liveConfetti += 1;
    removeOnEnd(el, function () { liveConfetti -= 1; });
  }

  function burst(x, y, hearts, spread, confetti) {
    if (reduceMotion) return;
    for (var i = 0; i < hearts; i++) spawnHeart(x, y, spread);
    for (var j = 0; j < (confetti || 0); j++) spawnConfetti(x, y);
  }

  // A tap = pointer goes down and up close together in place. Scrolling moves the
  // finger (or the browser sends pointercancel), so it never spawns hearts.
  var tapStart = null;
  document.addEventListener('pointerdown', function (e) {
    tapStart = e.target.closest(NO_HEART_SELECTOR) ? null : { x: e.clientX, y: e.clientY, t: Date.now() };
  });
  document.addEventListener('pointercancel', function () { tapStart = null; });
  document.addEventListener('pointerup', function (e) {
    if (!tapStart) return;
    var moved = Math.abs(e.clientX - tapStart.x) + Math.abs(e.clientY - tapStart.y);
    var isTap = moved <= TAP_MAX_MOVE_PX && Date.now() - tapStart.t <= TAP_MAX_MS;
    tapStart = null;
    if (isTap) burst(e.clientX, e.clientY, HEARTS_PER_TAP, 40, 0);
  });
  document.addEventListener('ecard:burst', function (e) {
    burst(e.detail.x, e.detail.y, e.detail.count || 12, 110, e.detail.confetti || 0);
  });
})();
