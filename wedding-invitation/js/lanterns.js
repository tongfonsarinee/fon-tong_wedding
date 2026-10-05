// Wishes sky: guests write a wish and release a floating lantern.
// With ECARD_CONFIG.endpoint the sky shows everyone's lanterns (tap one to read it);
// without it the guest's own lanterns stay on this phone and the wish can be sent by LINE.
(function () {
  'use strict';

  var DECOR_COUNT = 7;          // unlabeled lanterns that make the sky feel alive
  var MAX_SHOWN = 36;
  var CARD_MS = 7000;
  var STORE_KEY = 'ecard-wishes';

  var section = document.getElementById('wishes');
  if (!section) return;
  var sky = section.querySelector('.sky');
  var form = document.getElementById('wish-form');
  var nameInput = document.getElementById('wish-name');
  var messageInput = document.getElementById('wish-message');
  var countEl = document.getElementById('wish-count');
  var card = document.getElementById('wish-card');
  var lineLink = document.getElementById('wish-line');
  var api = window.EcardApi || { enabled: false };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cardTimer = null;
  var shown = 0;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function toast(msg) { if (window.EcardToast) window.EcardToast(msg); }

  function lantern(wish) {
    var el = document.createElement(wish ? 'button' : 'span');
    el.className = 'lantern' + (wish ? ' lantern--wish' : '') + (wish && wish.mine ? ' lantern--mine' : '');
    var depth = rand(0.65, 1.15);
    el.style.setProperty('--x', rand(4, 88).toFixed(1) + '%');
    el.style.setProperty('--y', rand(16, 58).toFixed(1) + '%'); // resting spot when motion is reduced
    el.style.setProperty('--s', depth.toFixed(2));
    el.style.setProperty('--dur', (rand(22, 34) / depth).toFixed(1) + 's');
    el.style.setProperty('--delay', (-rand(0, 30)).toFixed(1) + 's');
    el.style.setProperty('--sway', rand(3, 6).toFixed(1) + 's');
    el.innerHTML = '<i class="lantern__body"></i><i class="lantern__flame"></i>';
    if (wish) {
      el.type = 'button';
      el.setAttribute('aria-label', 'คำอวยพรจาก ' + wish.name);
      el.addEventListener('click', function () { showWish(wish); });
    } else {
      el.setAttribute('aria-hidden', 'true');
    }
    return el;
  }

  function showWish(wish) {
    card.querySelector('b').textContent = wish.name;
    card.querySelector('p').textContent = wish.message;
    card.hidden = false;
    card.classList.remove('is-shown');
    void card.offsetWidth;
    card.classList.add('is-shown');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(function () { card.hidden = true; }, CARD_MS);
    if (window.EcardAudio) window.EcardAudio.sfx('pop');
  }

  function addWish(wish) {
    if (shown >= MAX_SHOWN) return;
    shown += 1;
    sky.appendChild(lantern(wish));
  }

  function setCount(n) {
    if (!countEl) return;
    countEl.dataset.n = n;
    countEl.hidden = n < 1;
    countEl.textContent = 'โคมอวยพร ' + n + ' ดวง';
  }

  function localWishes() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveLocal(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-10))); } catch (e) { /* private mode */ }
  }

  // a new lantern lifts off from the form, rises out of sight, then rejoins the drifting sky from below
  function release(wish) {
    var el = lantern(wish);
    sky.appendChild(el);
    shown += 1;
    if (window.EcardAudio) { window.EcardAudio.sfx('whoosh'); window.EcardAudio.buzz([15, 30, 15]); }
    if (reduceMotion) return;
    el.classList.add('lantern--release');
    el.addEventListener('animationend', function done(e) {
      if (e.animationName !== 'lanternRelease') return;
      el.removeEventListener('animationend', done);
      el.classList.remove('lantern--release');
      el.style.setProperty('--x', rand(10, 80).toFixed(1) + '%');
      el.style.setProperty('--delay', '0s');
    });
  }

  function lineText(wish) {
    return 'คำอวยพรถึง ฝน & โต้ง 💌\n"' + wish.message + '"\n— ' + wish.name;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var wish = {
      name: nameInput.value.trim().slice(0, 40),
      message: messageInput.value.trim().slice(0, 200),
      mine: true
    };
    if (!wish.name) { nameInput.focus(); toast('กรุณาใส่ชื่อของท่าน'); return; }
    if (!wish.message) { messageInput.focus(); toast('เขียนคำอวยพรสักนิดนะ'); return; }

    release(wish);
    messageInput.value = '';
    var mine = localWishes();
    mine.push({ name: wish.name, message: wish.message });

    if (api.enabled) {
      api.send({ type: 'wish', name: wish.name, message: wish.message }).then(function () {
        toast('ปล่อยโคมแล้ว คำอวยพรส่งถึงบ่าวสาวแล้ว ♡');
        setCount(Number(countEl && countEl.dataset.n || 0) + 1);
      }).catch(function () {
        saveLocal(mine);
        toast('ส่งไม่สำเร็จ ลองส่งทาง LINE แทนได้นะ');
        lineLink.hidden = false;
        lineLink.onclick = function () { api.lineShare(lineText(wish)); };
      });
      return;
    }
    saveLocal(mine);
    toast('ปล่อยโคมแล้ว ♡');
    lineLink.hidden = false;
    lineLink.onclick = function () { api.lineShare(lineText(wish)); };
  });

  card.addEventListener('click', function () { card.hidden = true; });

  // ---- build the sky ----
  for (var i = 0; i < DECOR_COUNT; i++) sky.appendChild(lantern(null));
  if (window.ECARD_GUEST) nameInput.value = window.ECARD_GUEST;

  if (api.enabled) {
    api.listWishes().then(function (res) {
      var list = (res && res.wishes) || [];
      setCount(list.length);
      list.slice(-MAX_SHOWN).forEach(function (w) {
        addWish({ name: String(w.name || 'แขก').slice(0, 40), message: String(w.message || '').slice(0, 200) });
      });
    }).catch(function () { /* sky stays decorative */ });
  } else {
    localWishes().forEach(function (w) { addWish({ name: w.name, message: w.message, mine: true }); });
  }
})();
