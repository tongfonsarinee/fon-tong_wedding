// Wedding-day mode, driven by the clock (Bangkok time):
//   day before  → "พรุ่งนี้แล้ว" pill
//   on the day  → live pill "ตอนนี้: <rite>" + the schedule marks done / now / next
//   afterwards  → thank-you pill (+ shared-album button when ECARD_CONFIG.sharedAlbum is set)
// Preview any moment with ?now=2026-11-22T08:30 — also drives the countdown (window.EcardClock).
(function () {
  'use strict';

  var DAY_START = new Date('2026-11-22T00:00:00+07:00').getTime();
  var DAY_END = new Date('2026-11-23T00:00:00+07:00').getTime();
  var LAST_RITE_ENDS = new Date('2026-11-22T13:00:00+07:00').getTime();
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var TICK_MS = 30 * 1000;
  var MAPS_URL = 'https://maps.app.goo.gl/nRfCRox617bbrhkU9';

  // ?now= preview: the clock starts at that moment and keeps running
  var offset = 0;
  try {
    var raw = new URLSearchParams(window.location.search).get('now');
    if (raw) {
      if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(raw)) raw += '+07:00';
      var at = new Date(raw).getTime();
      if (!isNaN(at)) offset = at - Date.now();
    }
  } catch (e) { /* no URLSearchParams */ }
  function now() { return Date.now() + offset; }
  window.EcardClock = { now: now };

  var config = window.ECARD_CONFIG || {};
  var pill = document.getElementById('live');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.tl[data-at]'));
  if (!pill) return;
  var pillText = pill.querySelector('.live__text');
  var pillBtn = pill.querySelector('.live__btn');

  function riteTime(step) {
    return new Date('2026-11-22T' + step.dataset.at + ':00+07:00').getTime();
  }

  function setBadge(step, state, label) {
    step.classList.remove('is-done', 'is-now', 'is-next');
    var badge = step.querySelector('.tl__badge');
    if (!state) { if (badge) badge.remove(); return; }
    step.classList.add('is-' + state);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tl__badge';
      step.querySelector('.tl__body').appendChild(badge);
    }
    badge.textContent = label;
  }

  function showPill(text, mode, button) {
    pill.hidden = false;
    pill.className = 'live live--' + mode;
    pillText.textContent = text;
    pillBtn.hidden = !button;
    if (button) {
      pillBtn.textContent = button.label;
      pillBtn.href = button.href;
      if (/^https?:/.test(button.href)) { pillBtn.target = '_blank'; pillBtn.rel = 'noopener'; } else { pillBtn.removeAttribute('target'); }
    }
  }

  function minutesUntil(t) { return Math.max(1, Math.round((t - now()) / 60000)); }

  function update() {
    var t = now();
    var album = config.sharedAlbum ? { label: 'อัปโหลดรูปจากงาน', href: config.sharedAlbum } : null;

    if (t < DAY_START - MS_PER_DAY) { pill.hidden = true; return; }
    if (t < DAY_START) {
      showPill('พรุ่งนี้วันงานแล้ว เจอกันนะ ♡', 'soon', { label: 'ดูแผนที่', href: '#venue' });
      return;
    }
    if (t >= DAY_END) {
      steps.forEach(function (s) { setBadge(s, null); });
      showPill('ขอบคุณที่ร่วมเป็นเกียรติในวันของเรา ♡', 'after', album);
      return;
    }

    // on the day: which rite is happening?
    var times = steps.map(riteTime);
    var current = -1;
    times.forEach(function (start, i) {
      var end = i + 1 < times.length ? times[i + 1] : LAST_RITE_ENDS;
      if (t >= start && t < end) current = i;
    });
    var next = times.findIndex(function (start) { return start > t; });
    steps.forEach(function (s, i) {
      if (i === current) setBadge(s, 'now', 'กำลังจัดอยู่');
      else if (i === next) setBadge(s, 'next', 'ถัดไป · อีก ' + minutesUntil(times[i]) + ' นาที');
      else if (times[i] < t) setBadge(s, 'done', 'เสร็จแล้ว');
      else setBadge(s, null);
    });

    var title = function (i) { return steps[i].querySelector('.tl__th').textContent; };
    if (current >= 0) {
      showPill('วันนี้วันงาน · ตอนนี้: ' + title(current), 'now', album || { label: 'นำทาง', href: MAPS_URL });
    } else if (next >= 0) {
      showPill('วันนี้วันงาน · ' + title(next) + ' เริ่มในอีก ' + minutesUntil(times[next]) + ' นาที', 'now', { label: 'นำทาง', href: MAPS_URL });
    } else {
      showPill('ขอบคุณที่มาร่วมงานวันนี้ ♡', 'after', album);
    }
  }

  update();
  setInterval(update, TICK_MS);
})();
