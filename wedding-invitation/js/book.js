// Photo book: a 3D flip-book built from the album photos (#album, written by tools/import_photos.py).
// Tap the right half / swipe left to turn forward; left half / swipe right to go back.
(function () {
  'use strict';

  var FLIP_MS = 900;            // matches .book__page transition in css/gallery.css
  var SWIPE_PX = 40;

  var book = document.getElementById('book');
  var album = document.getElementById('album');
  if (!book || !album) return;

  var stage = book.querySelector('.book__stage');
  var inner = book.querySelector('.book__inner');
  var counter = book.querySelector('.book__count');
  var prevBtn = book.querySelector('[data-book="-1"]');
  var nextBtn = book.querySelector('[data-book="1"]');
  var items = Array.prototype.slice.call(album.querySelectorAll('.album__item'));
  if (!items.length) { book.hidden = true; return; }

  var photos = items.map(function (item) {
    var img = item.querySelector('img');
    return { type: 'photo', src: img.getAttribute('src'), number: item.dataset.number };
  });

  // faces in reading order; each page holds two (front on the right, back on the left once turned)
  var faces = [{ type: 'cover' }].concat(photos);
  if ((faces.length + 2) % 2) faces.push({ type: 'heart' });
  faces.push({ type: 'end' }, { type: 'back' });

  function faceHtml(face) {
    switch (face.type) {
      case 'cover':
        return '<div class="book__cover"><span class="book__cover-eyebrow">Our Moments</span>' +
          '<span class="book__cover-mono">S<i>P</i></span><span class="book__cover-names">Sarinee &amp; Pongsawat</span>' +
          '<span class="book__cover-date">22 · 11 · 2026</span><span class="book__cover-hint">แตะเพื่อเปิดอัลบั้ม</span></div>';
      case 'photo':
        return '<figure class="book__photo"><img src="' + face.src + '" alt="ภาพหมายเลข ' + face.number + '" loading="lazy" decoding="async">' +
          '<figcaption>No. ' + face.number + '</figcaption></figure>';
      case 'heart':
        return '<div class="book__note"><span class="book__note-heart">♥</span><span>Two hearts, one love</span></div>';
      case 'end':
        return '<div class="book__note"><span class="book__note-script">Thank you</span><span>for every moment</span><span class="book__note-heart">♥</span></div>';
      default:
        return '<div class="book__back"><span class="book__cover-mono">S<i>P</i></span></div>';
    }
  }

  var pages = [];
  for (var i = 0; i < faces.length; i += 2) {
    var page = document.createElement('div');
    page.className = 'book__page';
    page.innerHTML = '<div class="book__face book__face--front">' + faceHtml(faces[i]) + '</div>' +
      '<div class="book__face book__face--back">' + faceHtml(faces[i + 1]) + '</div>';
    inner.appendChild(page);
    pages.push(page);
  }

  var turned = 0; // pages already turned to the left
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function settleZ() {
    pages.forEach(function (p, idx) {
      p.style.zIndex = idx < turned ? idx + 1 : pages.length - idx;
    });
  }

  function render() {
    inner.classList.toggle('is-closed', turned === 0);
    inner.classList.toggle('is-finished', turned === pages.length);
    var spread = turned === 0 ? 'ปก' : turned === pages.length ? 'ปกหลัง' : turned + ' / ' + (pages.length - 1);
    if (counter) counter.textContent = spread;
    if (prevBtn) prevBtn.disabled = turned === 0;
    if (nextBtn) nextBtn.disabled = turned === pages.length;
  }

  function turn(direction) {
    var next = turned + direction;
    if (next < 0 || next > pages.length) return;
    var page = direction > 0 ? pages[turned] : pages[next];
    page.style.zIndex = pages.length + 2; // the moving page rides on top
    page.classList.toggle('is-turned', direction > 0);
    page.classList.add('is-moving');
    turned = next;
    render();
    if (window.EcardAudio) { window.EcardAudio.sfx('swish'); window.EcardAudio.buzz(8); }
    setTimeout(function () {
      page.classList.remove('is-moving');
      settleZ();
    }, reduceMotion ? 0 : FLIP_MS);
  }

  stage.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    var r = stage.getBoundingClientRect();
    var onLeft = e.clientX - r.left < r.width / 2;
    if (turned === 0) turn(1);
    else if (turned === pages.length) turn(-1);
    else turn(onLeft ? -1 : 1);
  });

  var startX = null;
  var swiped = false;
  stage.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    swiped = true; // swallow the click that follows
    turn(dx < 0 ? 1 : -1);
  });
  if (prevBtn) prevBtn.addEventListener('click', function () { turn(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { turn(1); });
  stage.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') turn(1);
    if (e.key === 'ArrowLeft') turn(-1);
  });

  settleZ();
  render();
})();
