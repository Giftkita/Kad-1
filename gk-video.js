/* ════════════════════════════════════════════════════════════
   gk-video.js — video YouTube & TikTok untuk semua kad GiftKita
   Dipakai oleh BORANG (buat-kad-*.html) dan VIEWER (card-*-1.html).

   VIEWER:
     GKVideo.ada(url)            → true kalau link YouTube / TikTok sah
     GKVideo.thumb(url)          → gambar kecil (YouTube) atau poster TikTok (SVG)
     GKVideo.main(url, iframe)   → set src + saiz iframe (TikTok/Shorts = tegak 9:16)
                                   pulangkan false kalau link tak boleh dibenam (link dibuka tab baru)
   BORANG:
     GKVideo.medan('idInput')    → status di bawah input + tukar link pendek TikTok
                                   (vt.tiktok.com/…) kepada link penuh secara automatik
   ════════════════════════════════════════════════════════════ */
(function () {
  if (window.GKVideo) return;
  var API = (location.hostname.indexOf('github.io') > -1) ? 'https://www.giftkita.com' : '';

  function info(u) {
    u = String(u || '').trim();
    if (!u) return null;
    var m = u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    if (m && /youtu/.test(u)) return { jenis: 'yt', id: m[1], tegak: /\/shorts\//.test(u) };
    m = u.match(/tiktok\.com\/(?:@[^\/?#]+\/video|v|embed(?:\/v2)?|player\/v1)\/(\d{8,25})/);
    if (m) return { jenis: 'tt', id: m[1], tegak: true };
    if (/^(https?:\/\/)?(vt|vm)\.tiktok\.com\/[A-Za-z0-9]+/.test(u) || /tiktok\.com\/t\/[A-Za-z0-9]+/.test(u))
      return { jenis: 'ttpendek', url: /^https?:/.test(u) ? u : 'https://' + u, tegak: true };
    return null;
  }

  function src(u) {
    var v = info(u); if (!v) return '';
    if (v.jenis === 'yt') return 'https://www.youtube.com/embed/' + v.id + '?autoplay=1&playsinline=1&rel=0';
    if (v.jenis === 'tt') return 'https://www.tiktok.com/player/v1/' + v.id + '?autoplay=1&rel=0&description=0&music_info=0';
    return '';
  }

  var POSTER_TT = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111"/><stop offset="1" stop-color="#2a1030"/></linearGradient></defs>' +
    '<rect width="480" height="360" fill="url(#g)"/>' +
    '<g transform="translate(200 120) scale(3.4)" fill="none">' +
    '<path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.82-2.47v-3.1a5.66 5.66 0 1 0 4.89 5.57V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.29 4.29 0 0 1-3.21-1.48Z" fill="#25F4EE" transform="translate(-.6 -.4)"/>' +
    '<path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.82-2.47v-3.1a5.66 5.66 0 1 0 4.89 5.57V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.29 4.29 0 0 1-3.21-1.48Z" fill="#FE2C55" transform="translate(.6 .4)"/>' +
    '<path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.82-2.47v-3.1a5.66 5.66 0 1 0 4.89 5.57V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.29 4.29 0 0 1-3.21-1.48Z" fill="#fff"/></g>' +
    '<text x="240" y="300" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#fff" opacity=".9">▶  TikTok</text></svg>');

  function thumb(u) {
    var v = info(u); if (!v) return '';
    if (v.jenis === 'yt') return 'https://img.youtube.com/vi/' + v.id + '/hqdefault.jpg';
    return POSTER_TT;
  }

  /* hentikan muzik kad sementara video main (MP3 / audio sahaja; YouTube muzik dihentikan oleh kad sendiri) */
  var dijeda = [];
  var asalPlay = HTMLMediaElement.prototype.play, semua = [];
  HTMLMediaElement.prototype.play = function () { if (semua.indexOf(this) < 0) semua.push(this); return asalPlay.apply(this, arguments); };
  function jedaMuzik() {
    semua.forEach(function (a) { try { if (!a.paused) { a.pause(); dijeda.push(a); } } catch (e) {} });
  }
  function sambungMuzik() {
    var l = dijeda; dijeda = [];
    l.forEach(function (a) { try { a.play(); } catch (e) {} });
  }

  function main(u, iframe) {
    var v = info(u); if (!v) return false;
    if (v.jenis === 'ttpendek') { window.open(v.url, '_blank', 'noopener'); return false; }
    if (iframe) {
      if (v.tegak) {
        iframe.style.aspectRatio = '9 / 16';
        iframe.style.width = 'min(86vw, calc(78vh * 9 / 16))';
        iframe.style.maxWidth = '100%';
        iframe.style.height = 'auto';
        iframe.style.margin = '0 auto';
        iframe.style.background = '#000';
      } else {
        ['aspectRatio', 'width', 'maxWidth', 'height', 'margin'].forEach(function (k) { iframe.style[k] = ''; });
      }
      iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      jedaMuzik();
      iframe.src = src(u);
      /* bila kad kosongkan src (popup ditutup) → sambung muzik */
      if (!iframe.__gkv) {
        iframe.__gkv = 1;
        new MutationObserver(function () { if (!iframe.getAttribute('src')) sambungMuzik(); })
          .observe(iframe, { attributes: true, attributeFilter: ['src'] });
      }
    }
    return true;
  }
  /* untuk kad yang bina iframe sendiri dalam HTML */
  function html(u, extra) {
    var v = info(u); if (!v || v.jenis === 'ttpendek') return '';
    var gaya = v.tegak ? ' style="aspect-ratio:9/16;width:min(86vw,calc(78vh*9/16));max-width:100%;height:auto;margin:0 auto;display:block;background:#000;border:0"' : '';
    jedaMuzik();
    return '<iframe src="' + src(u) + '"' + gaya + ' allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen' + (extra || '') + '></iframe>';
  }

  /* ── pemain skrin penuh siap (untuk kad yang tiada popup video sendiri) ──
     GKVideo.popup(url, { jeda:fn, sambung:fn })  — jeda/sambung = hentikan & sambung muzik YouTube kad */
  function popup(u, cb) {
    cb = cb || {};
    var v = info(u); if (!v) return false;
    if (v.jenis === 'ttpendek') { window.open(v.url, '_blank', 'noopener'); return false; }
    if (!document.getElementById('gkv-css')) {
      var st = document.createElement('style'); st.id = 'gkv-css';
      st.textContent = '#gkv-pop{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;animation:gkvIn .25s ease}' +
        '@keyframes gkvIn{from{opacity:0}}' +
        '#gkv-pop iframe{width:min(94vw,760px);aspect-ratio:16/9;border:0;border-radius:12px;background:#000;display:block}' +
        '#gkv-pop button{background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.35);color:#fff;padding:9px 22px;border-radius:50px;font:500 13px Poppins,system-ui,sans-serif;cursor:pointer}';
      document.head.appendChild(st);
    }
    var w = document.createElement('div'); w.id = 'gkv-pop';
    var f = document.createElement('iframe');
    var b = document.createElement('button'); b.type = 'button'; b.textContent = en() ? '✕ Close' : '✕ Tutup';
    w.appendChild(f); w.appendChild(b); document.body.appendChild(w);
    try { cb.jeda && cb.jeda(); } catch (e) {}
    main(u, f);
    function tutup() { w.remove(); sambungMuzik(); try { cb.sambung && cb.sambung(); } catch (e) {} }
    b.onclick = tutup;
    w.addEventListener('click', function (e) { if (e.target === w) tutup(); });
    return true;
  }

  /* ── BORANG: status + tukar link pendek TikTok ── */
  function en() { try { return localStorage.getItem('gk_lang') === 'en'; } catch (e) { return false; } }
  var TEKS = {
    kosong: ['Tampal link YouTube atau TikTok', 'Paste a YouTube or TikTok link'],
    yt: ['✅ Video YouTube dikesan', '✅ YouTube video detected'],
    ytS: ['✅ YouTube Shorts dikesan', '✅ YouTube Shorts detected'],
    tt: ['✅ Video TikTok dikesan', '✅ TikTok video detected'],
    semak: ['⏳ Menyemak link TikTok…', '⏳ Checking TikTok link…'],
    gagal: ['⚠️ Tak dapat baca link pendek TikTok. Di TikTok tekan Share → Copy link, atau buka video dalam browser & salin link penuh (ada /video/).',
            '⚠️ Could not read the short TikTok link. In TikTok tap Share → Copy link, or open the video in a browser & copy the full link (with /video/).'],
    salah: ['❌ Link tak dikenali. Guna link video YouTube atau TikTok.', '❌ Link not recognised. Use a YouTube or TikTok video link.'],
    ttFoto: ['❌ Ini post gambar TikTok. Hanya video TikTok boleh dimainkan.', '❌ This is a TikTok photo post. Only TikTok videos can be played.']
  };
  function tk(k) { return TEKS[k][en() ? 1 : 0]; }

  function resolve(u) {
    return fetch(API + '/api/admin?tt=' + encodeURIComponent(u)).then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.url) return d.url; throw new Error('x'); });
  }

  function medan(id) {
    var inp = typeof id === 'string' ? document.getElementById(id) : id;
    if (!inp || inp.__gkv) return; inp.__gkv = 1;
    inp.setAttribute('placeholder', en() ? 'YouTube or TikTok link' : 'Link YouTube atau TikTok');
    var st = document.createElement('div');
    st.style.cssText = 'font-size:.74rem;margin-top:6px;line-height:1.5;color:#8a7b82';
    inp.parentNode.insertBefore(st, inp.nextSibling);
    var tmr, giliran = 0;
    function kemas() {
      var u = inp.value.trim(), v = info(u), g = ++giliran;
      st.style.color = '#8a7b82';
      if (!u) { st.textContent = tk('kosong'); return; }
      if (/tiktok\.com\/@[^\/]+\/photo\//.test(u)) { st.textContent = tk('ttFoto'); st.style.color = '#c62828'; return; }
      if (!v) { st.textContent = tk('salah'); st.style.color = '#c62828'; return; }
      if (v.jenis === 'yt') { st.textContent = tk(v.tegak ? 'ytS' : 'yt'); st.style.color = '#1a9e54'; return; }
      if (v.jenis === 'tt') { st.textContent = tk('tt'); st.style.color = '#1a9e54'; return; }
      st.textContent = tk('semak');
      resolve(v.url).then(function (penuh) {
        if (g !== giliran) return;
        inp.value = penuh;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }).catch(function () { if (g !== giliran) return; st.textContent = tk('gagal'); st.style.color = '#b86e00'; });
    }
    inp.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(kemas, 350); });
    inp.addEventListener('change', kemas);
    kemas();
    var lama = en(); setInterval(function () { if (en() !== lama) { lama = en(); inp.setAttribute('placeholder', en() ? 'YouTube or TikTok link' : 'Link YouTube atau TikTok'); kemas(); } }, 700);
  }

  window.GKVideo = { info: info, ada: function (u) { return !!info(u); }, src: src, thumb: thumb, main: main, html: html, popup: popup,
                     medan: medan, jedaMuzik: jedaMuzik, sambungMuzik: sambungMuzik };
})();
