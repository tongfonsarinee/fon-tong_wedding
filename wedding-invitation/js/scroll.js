// Scroll-driven effects: fade-up reveals, ornaments that draw themselves, progress bar,
// schedule line that fills with gold, cover photo parallax, pausing looped animations offscreen
(function () {
  'use strict';

  var TIMELINE_TRIGGER = 0.62; // the gold line reaches the point 62% down the screen
  var PARALLAX_RATIO = 0.18;   // cover photo moves at 18% of scroll speed

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initReveal() {
    var items = document.querySelectorAll('.reveal, .draw');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { observer.observe(el); });
  }

  var bar = document.getElementById('progress');
  var timeline = document.getElementById('timeline');
  var steps = timeline ? Array.prototype.slice.call(timeline.querySelectorAll('.tl')) : [];
  var coverPhoto = document.querySelector('.arch__photo');
  var cover = document.querySelector('.cover');

  function updateProgress() {
    if (!bar) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
  }

  function updateTimeline() {
    if (!timeline) return;
    var line = window.innerHeight * TIMELINE_TRIGGER;
    var rect = timeline.getBoundingClientRect();
    var fill = Math.max(0, Math.min(1, (line - rect.top) / rect.height));
    timeline.style.setProperty('--progress', fill.toFixed(4));
    steps.forEach(function (step) {
      var icon = step.querySelector('.tl__icon') || step;
      var r = icon.getBoundingClientRect();
      step.classList.toggle('is-lit', r.top + r.height / 2 <= line);
    });
  }

  function updateParallax() {
    if (!coverPhoto || !cover || reduceMotion) return;
    var y = window.scrollY;
    if (y > cover.offsetHeight) return;
    coverPhoto.style.setProperty('--parallax', (y * PARALLAX_RATIO).toFixed(1) + 'px');
  }

  function onScroll() {
    updateProgress();
    updateTimeline();
    updateParallax();
  }

  var ticking = false;
  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      onScroll();
    });
  }

  // [data-pause] sections stop their looping animations while off screen (battery)
  function initPausing() {
    var items = document.querySelectorAll('[data-pause]');
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('is-offscreen', !entry.isIntersecting); });
    }, { rootMargin: '120px 0px' });
    items.forEach(function (el) { observer.observe(el); });
  }

  initReveal();
  initPausing();
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();
})();
