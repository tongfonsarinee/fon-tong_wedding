// Depth & light: tilting the phone (gyroscope) or moving the mouse sets --tx / --ty (-1…1) on <html>.
// CSS uses them for parallax layers, foil glints that follow the light, and [data-tilt] cards leaning in 3D.
// iPhone asks permission first, so intro.js calls EcardMotion.request() from the wax-seal tap.
(function () {
  'use strict';

  var FULL_TILT_DEG = 18;   // phone tilt that reaches the full effect
  var RECENTER = 0.004;     // the resting posture slowly becomes the new "flat"
  var SMOOTHING = 0.09;
  var SETTLED = 0.0015;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var root = document.documentElement;
  var lightGradients = document.querySelectorAll('linearGradient[data-light]'); // gold ink + gilded frame

  var target = { x: 0, y: 0 };
  var current = { x: 0, y: 0 };
  var rest = null;
  var looping = false;
  var listening = false;

  function clamp(v) { return Math.max(-1, Math.min(1, v)); }

  function frame() {
    current.x += (target.x - current.x) * SMOOTHING;
    current.y += (target.y - current.y) * SMOOTHING;
    root.style.setProperty('--tx', current.x.toFixed(3));
    root.style.setProperty('--ty', current.y.toFixed(3));
    // gold ink of the names and the gilded frame catch the light too
    var shift = 'translate(' + (current.x * 0.35).toFixed(3) + ' ' + (current.y * 0.2).toFixed(3) + ')';
    for (var i = 0; i < lightGradients.length; i++) lightGradients[i].setAttribute('gradientTransform', shift);
    if (Math.abs(target.x - current.x) < SETTLED && Math.abs(target.y - current.y) < SETTLED) {
      looping = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function nudge(x, y) {
    target.x = clamp(x);
    target.y = clamp(y);
    if (!root.classList.contains('has-motion')) root.classList.add('has-motion');
    if (!looping) {
      looping = true;
      requestAnimationFrame(frame);
    }
  }

  function onOrientation(e) {
    if (e.beta === null || e.gamma === null) return;
    if (!rest) rest = { beta: e.beta, gamma: e.gamma };
    rest.beta += (e.beta - rest.beta) * RECENTER;
    rest.gamma += (e.gamma - rest.gamma) * RECENTER;
    nudge((e.gamma - rest.gamma) / FULL_TILT_DEG, (e.beta - rest.beta) / FULL_TILT_DEG);
  }

  function listenOrientation() {
    if (listening || reduceMotion) return;
    listening = true;
    window.addEventListener('deviceorientation', onOrientation);
  }

  function request() {
    var DOE = window.DeviceOrientationEvent;
    if (!DOE || reduceMotion) return;
    if (typeof DOE.requestPermission === 'function') {
      // iOS 13+: must be called from a tap
      DOE.requestPermission().then(function (state) {
        if (state === 'granted') listenOrientation();
      }).catch(function () { /* declined: the card still works without depth */ });
    } else {
      listenOrientation();
    }
  }

  if (!reduceMotion) {
    // Android & others need no permission
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') listenOrientation();
    if (finePointer) {
      window.addEventListener('mousemove', function (e) {
        nudge((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
      }, { passive: true });
    }
  }

  window.EcardMotion = { request: request };
})();
