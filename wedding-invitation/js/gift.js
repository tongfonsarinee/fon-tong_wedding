// Online gift (ซองออนไลน์): shown only when ECARD_CONFIG.gift.qr is set
(function () {
  'use strict';

  var gift = (window.ECARD_CONFIG || {}).gift || {};
  var section = document.getElementById('gift');
  if (!section || !gift.qr) return;

  function fill(selector, text) {
    var el = section.querySelector(selector);
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  section.querySelector('.gift__qr').src = gift.qr;
  var save = section.querySelector('.gift__save');
  save.href = gift.qr;
  fill('.gift__bank', gift.bank);
  fill('.gift__name', gift.name);
  fill('.gift__number', gift.account);

  var copyBtn = section.querySelector('.gift__copy');
  copyBtn.hidden = !gift.account;
  copyBtn.addEventListener('click', function () {
    var digits = String(gift.account).replace(/[^\d]/g, '');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(digits).then(function () {
      if (window.EcardToast) window.EcardToast('คัดลอกเลขบัญชีแล้ว ✓');
    });
  });

  section.hidden = false;
})();
