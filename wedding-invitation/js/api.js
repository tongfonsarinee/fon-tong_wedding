// Talks to the Google Apps Script web app (tools/apps-script.gs) and builds LINE share links
(function () {
  'use strict';

  var endpoint = ((window.ECARD_CONFIG || {}).endpoint || '').trim();

  function asJson(response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }

  window.EcardApi = {
    enabled: !!endpoint,

    // { ok, wishes: [{ name, message }] }
    listWishes: function () {
      return fetch(endpoint + '?action=wishes', { cache: 'no-store' }).then(asJson);
    },

    // text/plain body keeps it a "simple" request, so Apps Script needs no CORS preflight
    send: function (payload) {
      return fetch(endpoint, { method: 'POST', body: JSON.stringify(payload) })
        .then(asJson)
        .then(function (json) {
          if (!json.ok) throw new Error(json.error || 'rejected');
          return json;
        });
    },

    // opens LINE's share sheet so the guest picks the couple as the recipient
    lineShare: function (text) {
      window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }
  };
})();
