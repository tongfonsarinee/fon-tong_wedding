// Photo album: 'show all' button and a swipeable lightbox with the full-size images
(function () {
  'use strict';

  var SWIPE_THRESHOLD_PX = 45;
  var SWITCH_FADE_MS = 200;

  var album = document.getElementById('album');
  var moreBtn = document.getElementById('gallery-more');
  var box = document.getElementById('lightbox');
  if (!album || !box) return;

  var items = Array.prototype.slice.call(album.querySelectorAll('.album__item'));
  var boxImg = box.querySelector('img');
  var counter = box.querySelector('.lightbox__count');
  var current = 0;

  function fullSrc(i) { return items[i].dataset.full; }
  function altText(i) { return items[i].querySelector('img').alt; }

  function preload(i) {
    var img = new Image();
    img.src = fullSrc((i + items.length) % items.length);
  }

  /* ----- "Show all" button ----- */
  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      album.classList.add('is-expanded');
      moreBtn.hidden = true;
    });
  }

  /* ----- Lightbox with prev / next / swipe ----- */
  function show(index) {
    current = (index + items.length) % items.length;
    var isOpen = box.classList.contains('is-open');
    boxImg.classList.add('is-switching');
    setTimeout(function () {
      boxImg.src = fullSrc(current);
      boxImg.alt = altText(current);
      boxImg.classList.remove('is-switching');
    }, isOpen ? SWITCH_FADE_MS : 0);
    // photo number (matches photo-numbers.csv), then position in the album
    counter.textContent = 'No. ' + items[current].dataset.number + ' · ' + (current + 1) + ' / ' + items.length;
    preload(current + 1);
    preload(current - 1);
  }

  function open(index) {
    show(index);
    box.classList.add('is-open');
    document.body.classList.add('is-locked');
  }

  function close() {
    box.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    boxImg.removeAttribute('src');
  }

  items.forEach(function (item, i) {
    item.addEventListener('click', function () { open(i); });
  });

  box.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (nav) { show(current + Number(nav.dataset.nav)); return; }
    if (e.target === boxImg) return;
    close();
  });

  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'ArrowLeft') show(current - 1);
  });

  var touchStartX = null;
  box.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    show(current + (dx < 0 ? 1 : -1));
  });
})();
