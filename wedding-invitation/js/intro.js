// Opening screen: bokeh + gold glitter, then the envelope sequence
// (seal pops → flap opens → letter rises → fly into the card); starts petals after opening
(function () {
  'use strict';

  var SPARKLE_COUNT = 18;
  var GLINT_COUNT = 110;
  var BOKEH_COUNT = 9;
  var BOKEH_COLORS = ['rgba(240, 216, 166, .65)', 'rgba(255, 255, 255, .7)', 'rgba(234, 194, 184, .7)', 'rgba(201, 132, 118, .45)'];
  var SPARKLE_COLORS = ['#D9B676', '#F0D9A4', '#FFFFFF', '#E7B7AA'];
  var PETAL_COUNT = 16;
  var PETAL_LIGHT_RATIO = 0.4;
  var GOLD_DUST_COUNT = 14; // gold specks falling among the petals
  var CARD_THEME_COLOR = '#F3D5CC';

  // ms after the tap — each step matches a transition in css/intro.css
  var STEP_FLAP_OPEN = 380;
  var STEP_FLAP_BEHIND = 780; // flap has passed vertical: tuck it behind the letter
  var STEP_LETTER_OUT = 820;
  var STEP_FLY_IN = 1950;
  var STEP_REMOVE = 2850; // .intro opacity/transform transition is .9s

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function spawn(container, count, build) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) frag.appendChild(build(i));
    container.appendChild(frag);
  }

  function makeSparkle() {
    var el = document.createElement('span');
    el.className = 'sparkle';
    el.style.left = rand(4, 96) + '%';
    el.style.top = rand(6, 94) + '%';
    el.style.setProperty('--size', rand(10, 22).toFixed(0) + 'px');
    el.style.setProperty('--color', pick(SPARKLE_COLORS));
    el.style.setProperty('--dur', rand(3, 6).toFixed(2) + 's');
    el.style.setProperty('--delay', rand(0, 5).toFixed(2) + 's');
    return el;
  }

  // tiny glowing gold speck that flickers quickly
  function makeGlint() {
    var el = document.createElement('span');
    el.className = 'glint';
    el.style.left = rand(2, 98) + '%';
    el.style.top = rand(2, 98) + '%';
    el.style.setProperty('--size', rand(2, 4.5).toFixed(1) + 'px');
    el.style.setProperty('--dur', rand(0.9, 2.6).toFixed(2) + 's');
    el.style.setProperty('--delay', rand(0, 3).toFixed(2) + 's');
    return el;
  }

  // large soft light that drifts slowly
  function makeBokeh() {
    var el = document.createElement('span');
    el.className = 'bokeh';
    el.style.left = rand(-6, 96) + '%';
    el.style.top = rand(-4, 96) + '%';
    el.style.setProperty('--size', rand(36, 130).toFixed(0) + 'px');
    el.style.setProperty('--color', pick(BOKEH_COLORS));
    el.style.setProperty('--alpha', rand(0.2, 0.45).toFixed(2));
    el.style.setProperty('--dx', rand(-30, 30).toFixed(0) + 'px');
    el.style.setProperty('--dur', rand(7, 13).toFixed(2) + 's');
    el.style.setProperty('--delay', rand(-8, 0).toFixed(2) + 's');
    return el;
  }

  function makePetal() {
    var el = document.createElement('span');
    el.className = Math.random() < PETAL_LIGHT_RATIO ? 'petal petal--light' : 'petal';
    el.style.left = rand(0, 100) + '%';
    el.style.setProperty('--size', rand(8, 15).toFixed(1) + 'px');
    el.style.setProperty('--dur', rand(10, 18).toFixed(2) + 's');
    el.style.setProperty('--delay', rand(0, 12).toFixed(2) + 's');
    el.style.setProperty('--drift', rand(-80, 120).toFixed(0) + 'px');
    el.style.setProperty('--spin', rand(240, 720).toFixed(0) + 'deg');
    return el;
  }

  function makeGoldDust() {
    var el = makePetal();
    el.className = 'petal petal--gold';
    el.style.setProperty('--size', rand(3, 6).toFixed(1) + 'px');
    return el;
  }

  function startPetals() {
    var layer = document.getElementById('petals');
    if (!layer || reduceMotion) return;
    spawn(layer, PETAL_COUNT, makePetal);
    spawn(layer, GOLD_DUST_COUNT, makeGoldDust);
  }

  function enterCard() {
    var card = document.querySelector('.card');
    if (card) card.classList.add('is-entered');
    startPetals();
  }

  function initIntro() {
    var intro = document.getElementById('intro');
    var openBtn = document.getElementById('intro-open');
    var seal = document.getElementById('intro-seal');
    if (!intro || !openBtn) {
      enterCard();
      return;
    }

    document.body.classList.add('is-locked');
    var sky = intro.querySelector('.intro__sky') || intro;
    spawn(sky, BOKEH_COUNT, makeBokeh);
    if (!reduceMotion) {
      spawn(sky, SPARKLE_COUNT, makeSparkle);
      spawn(sky, GLINT_COUNT, makeGlint);
    }

    var opened = false;

    function step(delay, className) {
      setTimeout(function () { intro.classList.add(className); }, delay);
    }

    function flyIn() {
      intro.classList.add('is-opening');
      var themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', CARD_THEME_COLOR);
      window.scrollTo(0, 0);
      enterCard();
    }

    function finish() {
      intro.remove();
      document.body.classList.remove('is-locked');
    }

    function open() {
      if (opened) return;
      opened = true;
      openBtn.disabled = true;
      if (seal) seal.disabled = true;

      if (reduceMotion) {
        flyIn();
        finish();
        return;
      }

      // hearts + confetti burst from the seal as it breaks
      if (seal) {
        var r = seal.getBoundingClientRect();
        document.dispatchEvent(new CustomEvent('ecard:burst', {
          detail: { x: r.left + r.width / 2, y: r.top + r.height / 2, count: 14, confetti: 26 }
        }));
      }
      intro.classList.add('is-unsealing');
      step(STEP_FLAP_OPEN, 'is-flap-open');
      step(STEP_FLAP_BEHIND, 'is-flap-behind');
      step(STEP_LETTER_OUT, 'is-letter-out');
      setTimeout(flyIn, STEP_FLY_IN);
      setTimeout(finish, STEP_REMOVE);
    }

    openBtn.addEventListener('click', open);
    if (seal) seal.addEventListener('click', open);
  }

  initIntro();
})();
