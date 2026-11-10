(function () {
  if (window.__bidExtract) return;
  // Lê todas as tabelas visíveis na página (texto + 1º link de cada célula).
  window.__bidExtract = function () {
    var tables = [];
    document.querySelectorAll('table').forEach(function (t) {
      var rows = [];
      t.querySelectorAll('tr').forEach(function (tr) {
        var cells = tr.querySelectorAll('th,td');
        if (!cells.length) return;
        var c = [], h = [];
        cells.forEach(function (x) {
          c.push((x.innerText || x.textContent || '').trim());
          var a = x.querySelector('a[href]');
          h.push(a ? a.href : '');
        });
        rows.push({ th: !!tr.querySelector('th'), c: c, h: h });
      });
      if (rows.length) tables.push({ rows: rows });
    });
    return {
      url: location.href,
      text: (document.body.innerText || '').slice(0, 20000),
      tables: tables
    };
  };
  window.__bidCapture = function () {
    window.BIDApp.onCapture(JSON.stringify(window.__bidExtract()));
  };
  // Modo automático: lê de novo sempre que a página muda (depois que VOCÊ faz a consulta).
  window.__bidAuto = false;
  var timer;
  new MutationObserver(function () {
    if (!window.__bidAuto) return;
    clearTimeout(timer);
    timer = setTimeout(window.__bidCapture, 1500);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
