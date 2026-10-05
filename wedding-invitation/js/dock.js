// Floating bottom dock: section shortcuts, share button, toast messages
(function () {
  'use strict';

  var TOAST_MS = 2200;
  var SHARE_TEXT = 'ขอเรียนเชิญร่วมเป็นเกียรติในงานฉลองมงคลสมรส ฝน & โต้ง (สาริณี & พงษ์สวัสดิ์) · วันอาทิตย์ที่ 22 พฤศจิกายน 2569 · ร้อยเอ็ด';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- Toast ----- */
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-shown'); }, TOAST_MS);
  }
  window.EcardToast = toast; // used by wishes, photo booth, gift

  /* ----- Share (without the guest's name in the link) ----- */
  function cleanUrl() {
    return window.location.origin + window.location.pathname;
  }

  function share() {
    var url = cleanUrl();
    if (navigator.share) {
      navigator.share({ title: document.title, text: SHARE_TEXT, url: url }).catch(function (err) {
        if (err && err.name !== 'AbortError') toast('แชร์ไม่สำเร็จ ลองใหม่อีกครั้ง');
      });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('คัดลอกลิงก์แล้ว ✓');
      }, function () {
        window.open('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url), '_blank', 'noopener');
      });
      return;
    }
    window.open('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url), '_blank', 'noopener');
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-share]'), function (btn) {
    btn.addEventListener('click', share);
  });

  /* ----- Dock navigation ----- */
  var dock = document.getElementById('dock');
  var cover = document.querySelector('.cover');
  if (dock) {
    var buttons = Array.prototype.slice.call(dock.querySelectorAll('[data-target]'));
    var sections = buttons.map(function (b) { return document.getElementById(b.dataset.target); });

    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        if (sections[i]) sections[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });

    if ('IntersectionObserver' in window) {
      if (cover) {
        new IntersectionObserver(function (entries) {
          dock.classList.toggle('is-shown', !entries[0].isIntersecting);
        }, { threshold: 0.35 }).observe(cover);
      } else {
        dock.classList.add('is-shown');
      }

      var sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var idx = sections.indexOf(entry.target);
          buttons.forEach(function (b, j) { b.classList.toggle('is-active', j === idx); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      sections.forEach(function (s) { if (s) sectionObserver.observe(s); });
    } else {
      dock.classList.add('is-shown');
    }
  }
})();
