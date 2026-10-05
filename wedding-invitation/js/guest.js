// Personalised greeting: ?to=<name> fills every [data-guest] element (links built by invite-links.html)
(function () {
  'use strict';

  // Personalised greeting from ?to=<guest name>
  var MAX_NAME_LENGTH = 60;
  var DEFAULT_GUEST = 'แขกผู้มีเกียรติ';

  function readGuestName() {
    var raw;
    try {
      raw = new URLSearchParams(window.location.search).get('to');
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    var cleaned = raw
      .replace(/[\u0000-\u001F\u007F<>]/g, '') // control chars and angle brackets
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    return cleaned || null;
  }

  var name = readGuestName() || DEFAULT_GUEST;
  // textContent only — the name is never parsed as HTML
  Array.prototype.forEach.call(document.querySelectorAll('[data-guest]'), function (el) {
    el.textContent = name;
  });
})();
