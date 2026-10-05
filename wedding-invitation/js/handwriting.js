// Gold-ink handwriting: each glyph outline of the couple's names (SVG .ink, paths made from Great Vibes)
// is traced by a glowing pen nib, then flooded with gold. Starts when the card opens ('ecard:entered').
(function () {
  'use strict';

  var MS_PER_1000_UNITS = 150;  // pen speed along the outline (font units)
  var MIN_GLYPH_MS = 140;
  var MAX_GLYPH_MS = 480;
  var OVERLAP = 0.5;            // next glyph starts when the current one is half traced
  var START_DELAY_MS = 750;     // let the arch photo settle first

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var svgs = Array.prototype.slice.call(document.querySelectorAll('.ink'));
  if (!svgs.length || reduceMotion) return;

  var strokes = [];
  svgs.forEach(function (svg) {
    var pen = svg.querySelector('.ink__pen');
    Array.prototype.forEach.call(svg.querySelectorAll('path'), function (path) {
      var length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      strokes.push({ svg: svg, path: path, pen: pen, length: length });
    });
    svg.classList.add('is-inking');
  });

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function trace(stroke, onAlmostDone) {
    var duration = Math.max(MIN_GLYPH_MS, Math.min(MAX_GLYPH_MS, stroke.length / 1000 * MS_PER_1000_UNITS));
    var begin = performance.now();
    var handedOff = false;
    stroke.svg.classList.add('is-writing');
    if (window.EcardAudio) window.EcardAudio.buzz(4);

    function frame(now) {
      var t = Math.min(1, (now - begin) / duration);
      var drawn = stroke.length * ease(t);
      stroke.path.style.strokeDashoffset = stroke.length - drawn;
      if (stroke.pen) {
        var pt = stroke.path.getPointAtLength(drawn);
        stroke.pen.setAttribute('cx', pt.x.toFixed(1));
        stroke.pen.setAttribute('cy', pt.y.toFixed(1));
      }
      if (!handedOff && t >= OVERLAP) {
        handedOff = true;
        onAlmostDone();
      }
      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }
      stroke.path.classList.add('is-filled');
    }
    requestAnimationFrame(frame);
  }

  function writeFrom(index) {
    if (index >= strokes.length) {
      setTimeout(function () {
        svgs.forEach(function (svg) { svg.classList.remove('is-writing'); });
      }, 400);
      return;
    }
    var stroke = strokes[index];
    // the pen leaves an svg once its last glyph is handed off
    var prev = strokes[index - 1];
    if (prev && prev.svg !== stroke.svg) prev.svg.classList.remove('is-writing');
    trace(stroke, function () { writeFrom(index + 1); });
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    setTimeout(function () { writeFrom(0); }, START_DELAY_MS);
  }

  document.addEventListener('ecard:entered', start);
  var card = document.querySelector('.card');
  if (card && card.classList.contains('is-entered')) start();
})();
