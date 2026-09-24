/* ════════════════════════════════════════════════════════════
   gk-notis.js — notis & mod penyelenggaraan GiftKita
   Dikawal dari admin.html → Tetapan → "Notis & Penyelenggaraan".
   Data: GET /api/admin?notis=1  (awam, dicache 30 saat)

   Pasang di page KEDAI sahaja (index, pemilih tema, borang buat-kad-*,
   bouquet-muka, semak-kad, affiliate):
     <script src="gk-notis.js" defer></script>
   JANGAN pasang di card-*-1.html (penerima kad) atau bayar.html.

   Apa yang dibuat:
   1. Banner di atas page (boleh ditutup customer).
   2. Borang template yang ditanda "penyelenggaraan" → skrin penuh
      "sedang diselenggara" + butang pilih template lain.
   3. Link ke template tersebut di page pemilih → lencana 🔧 + tak boleh tekan.
   4. "Tutup semua jualan" → semua borang disekat (semak kad & affiliate tetap buka).
   ════════════════════════════════════════════════════════════ */
(function () {
  if (window.__gkNotis) return; window.__gkNotis = 1;
  var API = (location.hostname.indexOf('github.io') > -1) ? 'https://www.giftkita.com' : '';
  var WA = '60104553683';
  var CKEY = 'gk_notis_c';

  function en() { try { return localStorage.getItem('gk_lang') === 'en'; } catch (e) { return false; } }
  function kunci(href) {   // "buat-kad-butterfly.html?ref=X" → "buat-kad-butterfly"
    try { var p = new URL(href, location.href).pathname; return (p.split('/').pop() || 'index.html').replace(/\.html?$/, '') || 'index'; }
    catch (e) { return ''; }
  }
  var HALAMAN = kunci(location.href);
  function borang(k) { return /^buat-kad-(?!anniversary$|graduasi$)[a-z0-9-]+$/.test(k) || k === 'bouquet-muka'; }
  function t(n, ms, enTxt) { return (en() && enTxt) ? enTxt : ms; }
  function bila(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    try {
      return d.toLocaleString(en() ? 'en-GB' : 'ms-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });
    } catch (e) { return d.toLocaleString(); }
  }

  var css = '' +
    '#gkn-bar{position:fixed;top:10px;left:10px;right:10px;max-width:560px;margin:0 auto;z-index:99980;display:flex;align-items:flex-start;gap:10px;padding:11px 12px 11px 14px;font:500 13px/1.45 Poppins,system-ui,sans-serif;color:#3a2330;background:#fff4df;border:1px solid #ffd9a0;border-radius:14px;box-shadow:0 10px 30px rgba(43,26,36,.18);text-align:left;animation:gknIn .35s ease}' +
    '@keyframes gknIn{from{transform:translateY(-12px);opacity:0}}' +
    '#gkn-bar.info{background:#fdf0f5;border-color:#f6c4d6}#gkn-bar.maint{background:#fff4df;border-color:#ffd9a0}#gkn-bar.warn{background:#fdecec;border-color:#f5b5b5}' +
    '#gkn-bar .i{flex:0 0 auto;font-size:16px;line-height:1.3}#gkn-bar .m{flex:1;min-width:0;white-space:pre-line}#gkn-bar .m small{display:block;color:#8a6d7a;font-size:11.5px;margin-top:1px}' +
    '#gkn-bar button{flex:0 0 auto;border:0;background:transparent;color:#8a6d7a;font-size:18px;line-height:1;cursor:pointer;padding:0 2px}' +
    '.gkn-tutup{position:relative;pointer-events:auto!important;cursor:not-allowed!important}' +
    '.gkn-tutup>*{opacity:.45;filter:grayscale(.6)}' +
    '.gkn-tutup>.gkn-lencana{position:absolute;top:8px;left:8px;right:8px;z-index:3;opacity:1!important;filter:none!important;background:#3a2330!important;color:#fff!important;font:600 11.5px/1 Poppins,system-ui,sans-serif!important;text-align:center;letter-spacing:0!important;text-transform:none!important;padding:8px 10px;border-radius:50px;box-shadow:0 4px 12px rgba(0,0,0,.18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#gkn-full{position:fixed;inset:0;z-index:99990;background:rgba(43,26,36,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px}' +
    '#gkn-full .box{max-width:400px;width:100%;background:#fff;border-radius:24px;padding:28px 22px 22px;text-align:center;font-family:Poppins,system-ui,sans-serif;color:#3a2330;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
    '#gkn-full .e{font-size:44px;line-height:1}#gkn-full h2{font-size:19px;margin:12px 0 6px}#gkn-full p{font-size:13.5px;color:#6f5563;line-height:1.55;white-space:pre-line}' +
    '#gkn-full .sb{display:inline-block;margin-top:10px;font-size:12px;font-weight:600;color:#b86e00;background:#fff4df;padding:5px 12px;border-radius:50px}' +
    '#gkn-full a{display:block;margin-top:10px;padding:13px;border-radius:12px;font-weight:600;font-size:14px;text-decoration:none}' +
    '#gkn-full .p{margin-top:18px;background:linear-gradient(135deg,#e91e63,#c2185b);color:#fff}#gkn-full .s{background:#e8f8ee;color:#1a9e54}#gkn-full .x{background:none;color:#8a6d7a;font-weight:500;padding:8px}';

  function pasangCss() {
    if (document.getElementById('gkn-css')) return;
    var s = document.createElement('style'); s.id = 'gkn-css'; s.textContent = css; document.head.appendChild(s);
  }
  function el(tag, attrs, teks) {
    var e = document.createElement(tag);
    for (var k in attrs) { if (k === 'cls') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tandatangan(n) { return [n.jenis, n.msg_ms, n.msg_en, n.until].join('|'); }

  function banner(n) {
    var lama = document.getElementById('gkn-bar'); if (lama) lama.remove();
    if (!n.on || !(n.msg_ms || n.msg_en)) return;
    try { if (sessionStorage.getItem('gk_notis_x') === tandatangan(n)) return; } catch (e) {}
    var ikon = { info: '📢', maint: '🔧', warn: '⚠️' }[n.jenis] || '📢';
    var bar = el('div', { id: 'gkn-bar', cls: n.jenis || 'info', role: 'status' });
    bar.appendChild(el('span', { cls: 'i' }, ikon));
    var m = el('div', { cls: 'm' }, t(0, n.msg_ms || n.msg_en, n.msg_en));
    if (n.until) m.appendChild(el('small', {}, t(0, 'Dijangka siap: ', 'Expected back: ') + bila(n.until)));
    bar.appendChild(m);
    var x = el('button', { 'aria-label': t(0, 'Tutup notis', 'Close notice') }, '×');
    x.onclick = function () { bar.remove(); try { sessionStorage.setItem('gk_notis_x', tandatangan(n)); } catch (e) {} };
    bar.appendChild(x);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function skrinPenuh(n, semua) {
    if (document.getElementById('gkn-full')) return;
    var w = el('div', { id: 'gkn-full', role: 'dialog', 'aria-modal': 'true' });
    var b = el('div', { cls: 'box' });
    b.appendChild(el('div', { cls: 'e' }, '🔧'));
    b.appendChild(el('h2', {}, semua ? t(0, 'Kami sedang buat penambahbaikan', 'We\'re making some improvements')
                                     : t(0, 'Template ini sedang diselenggara', 'This template is under maintenance')));
    var ayat = (n.on && (n.msg_ms || n.msg_en)) ? t(0, n.msg_ms || n.msg_en, n.msg_en)
      : (semua ? t(0, 'Tempahan kad ditutup sementara. Sila cuba semula sebentar lagi. Terima kasih atas kesabaran anda 💝',
                    'Card orders are temporarily closed. Please try again shortly. Thank you for your patience 💝')
               : t(0, 'Kami sedang baiki template ini supaya lebih cantik. Sila pilih template lain dahulu, atau cuba semula sebentar lagi 💝',
                    'We\'re polishing this template. Please choose another template for now, or try again shortly 💝'));
    b.appendChild(el('p', {}, ayat));
    if (n.until) b.appendChild(el('span', { cls: 'sb' }, '⏳ ' + t(0, 'Dijangka siap: ', 'Expected back: ') + bila(n.until)));
    if (!semua) b.appendChild(el('a', { cls: 'p', href: 'index.html' + location.search }, t(0, '← Pilih template lain', '← Choose another template')));
    else b.appendChild(el('a', { cls: 'p', href: 'semak-kad.html' }, t(0, 'Semak kad yang dah dibeli', 'Find a card I bought')));
    b.appendChild(el('a', { cls: 's', href: 'https://wa.me/' + WA, target: '_blank', rel: 'noopener' }, t(0, '💬 Tanya kami di WhatsApp', '💬 Ask us on WhatsApp')));
    if (semua) b.appendChild(el('a', { cls: 'x', href: 'index.html' }, t(0, 'Ke laman utama', 'Go to home page')));
    w.appendChild(b);
    document.body.appendChild(w);
    var bar = document.getElementById('gkn-bar'); if (bar) bar.style.display = 'none';
    document.documentElement.style.overflow = 'hidden';
  }

  function tandaLink(n) {
    var senarai = n.templates || [];
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], k = kunci(a.getAttribute('href'));
      if (!k || a.classList.contains('gkn-tutup')) continue;
      var tutup = senarai.indexOf(k) > -1 || (n.tutup && borang(k));
      if (!tutup) continue;
      a.classList.add('gkn-tutup');
      if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
      a.appendChild(el('span', { cls: 'gkn-lencana' }, t(0, '🔧 Penyelenggaraan', '🔧 Maintenance')));
      a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); skrinPenuh(n, false); }, true);
    }
  }
  function lepasKlikFull(e) {   // tutup skrin penuh bila tekan luar (hanya dari link, bukan page borang)
    var w = document.getElementById('gkn-full');
    if (w && e.target === w && !borang(HALAMAN)) { w.remove(); document.documentElement.style.overflow = '';
      var bar = document.getElementById('gkn-bar'); if (bar) bar.style.display = ''; }
  }

  function guna(n) {
    if (!n || typeof n !== 'object') return;
    pasangCss();
    banner(n);
    var senarai = n.templates || [];
    if (borang(HALAMAN) && (n.tutup || senarai.indexOf(HALAMAN) > -1)) skrinPenuh(n, !!n.tutup);
    tandaLink(n);
  }

  function mula() {
    var cache = null;
    try { cache = JSON.parse(sessionStorage.getItem(CKEY) || 'null'); } catch (e) {}
    if (cache && Date.now() - cache.t < 60000) { guna(cache.n); return; }
    fetch(API + '/api/admin?notis=1', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (n) { try { sessionStorage.setItem(CKEY, JSON.stringify({ t: Date.now(), n: n })); } catch (e) {} guna(n); })
      .catch(function () {});
  }
  document.addEventListener('click', lepasKlikFull);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mula); else mula();
})();
