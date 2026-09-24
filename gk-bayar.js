/* ══════════════════════════════════════════════════════════════
   GiftKita — Enjin Bayaran Bersama
   Satu file untuk SEMUA borang kad.

   Cara guna (TIADA perubahan untuk borang sedia ada):
     <div id="gk-bayar"></div>
     <script src="gk-bayar.js"></script>
     <script>
       GKBayar.mount({
         el:'gk-bayar',
         viewer:'card-couple-1.html',
         collect:collectData,
         produk:'Kad Anniversary',   // nama produk pada ringkasan
         qr:false                    // tukar true bila DuitNow QR diluluskan
       });
     </script>

   DUA MATA WANG (Sep 2026):
     • Malaysia  → RM, FPX / DuitNow QR melalui ToyyibPay   (/api/create-bill)
     • Luar negara → USD, kad / Apple Pay / Google Pay melalui Stripe (/api/create-checkout)
   Dikesan ikut zon masa telefon. Customer boleh tukar sendiri dengan link kecil.
   Harga USD lalai: basic $8, premium $10, bouquet $3 (SERVER yang tentukan harga sebenar).
   Pelan boleh ada usd / nm_en / ds_en sendiri:
     plans:{ bouquet:{ rm:3, usd:3, nm:'Bouquet Muka', ds:'…', nm_en:'Photo Bouquet', ds_en:'…' } }

   Test mod USD sebelum STRIPE_ON=true:  buka borang dengan  ?cur=usd
   Balik ke RM:                          ?cur=myr

   Bahasa ikut localStorage 'gk_lang' (ms/en) — sama dengan borang. Bertukar sendiri
   bila customer tekan BM/EN.

   Warna ikut tema borang melalui CSS variable:
     --gk-accent  dan  --gk-accent-2
   ══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ▼▼▼ Tukar ke true bila Stripe dah test & kunci live dah dimasukkan dalam Vercel ▼▼▼ */
var STRIPE_ON = false;
/* ▲▲▲ Selagi false: semua customer nampak RM. Mod USD hanya untuk test (?cur=usd). ▲▲▲ */

var SB_URL='https://lejpuajafuenlfvlovfg.supabase.co';
var SB_KEY='sb_publishable_igFE4w_dz4ZF99wH1LeBKg_JL5kFoZ0';
var API_BASE=(location.hostname.indexOf('github.io')>-1)?'https://www.giftkita.com':'';

var db=null;
try{ if(window.supabase&&window.supabase.createClient) db=window.supabase.createClient(SB_URL,SB_KEY); }catch(e){ db=null; }

var CFG={};
/* Pelan lalai untuk kad. Borang boleh ganti dengan CFG.plans.
   Kunci pelan (basic/premium/bouquet) dihantar ke server — server MESTI kenal kunci
   tu dan tetapkan harga yang sama (create-bill.js untuk RM, create-checkout.js untuk USD). */
var PLAN_LALAI={
  basic:  { rm:6, usd:8,  nm:'Basic',   ds:'Muzik YouTube · link kekal',       ds_en:'YouTube music · permanent link' },
  premium:{ rm:8, usd:10, nm:'Premium', ds:'MP3 sendiri · kod QR · album PDF', ds_en:'Your own MP3 · QR code · PDF album' }
};
var USD_LALAI={ basic:8, premium:10, bouquet:3 };
var EN_LALAI={
  basic:  { nm:'Basic',   ds:'YouTube music · permanent link' },
  premium:{ nm:'Premium', ds:'Your own MP3 · QR code · PDF album' },
  bouquet:{ nm:'Photo Bouquet', ds:'Full image without watermark · instant download' }
};
var PLANS=PLAN_LALAI;

/* ───────── teks dwibahasa ───────── */
var T={
  ms:{
    ringkasan:'Ringkasan pesanan', kad:'Kad digital', kuantiti:'Kuantiti', harga:'Harga', jumlah:'Jumlah dibayar',
    cara:'Cara bayaran diterima', fpx:'Perbankan Internet', qr:'DuitNow QR', kadkredit:'Kad kredit / debit',
    fee:'Bayaran melalui <b>DuitNow QR</b> dikenakan caj pemprosesan <b>RM1.00</b> oleh penyedia pembayaran, ditambah pada jumlah anda. Bayaran melalui <b>FPX</b> tiada caj tambahan.',
    feeUsd:'Harga dalam <b>dolar AS (USD)</b>. Bank anda mungkin menukar ke mata wang tempatan.',
    nama:'Nama anda', namaPh:'cth: Aina Sofea', tel:'No. telefon (WhatsApp)', telOpt:'No. telefon', telPh:'cth: 0123456789',
    email:'Email', emailPh:'cth: aina@gmail.com',
    hint:'Resit dihantar ke email ini. Guna email &amp; telefon yang sama jika anda perlu cari semula link kad nanti.',
    hintUsd:'Resit dihantar ke email ini. Simpan email &amp; no. telefon ini, anda perlukannya untuk cari semula link kad di halaman Semak Kad.',
    btn:'Bayar &amp; dapatkan link kad', btnUsd:'Bayar {harga} dengan kad',
    safe:'Pembayaran dilindungi &amp; disulitkan melalui ToyyibPay', safeUsd:'Pembayaran kad dilindungi &amp; disulitkan melalui Stripe',
    tip:'Selepas bayar, jika bank papar &quot;transaction is being processed&quot;, tekan <b>Close</b> sahaja. Anda akan dibawa kembali ke halaman link kad secara automatik.',
    tipUsd:'Selepas bayar, anda akan dibawa terus ke halaman link kad anda.',
    mwT:'Anda bayar dari', mwMy:'🇲🇾 Malaysia', mwMyS:'RM · FPX / DuitNow', mwUs:'🌍 Luar negara', mwUsS:'USD · kad / Apple Pay',
    prev:'Lihat kad dulu — percuma', prevS:'Tengok rupa sebenar kad anda. Tiada bayaran, tiada maklumat diperlukan.',
    eDb:'Sambungan ke pangkalan data gagal. Refresh halaman dan cuba lagi.',
    eIsi:'Isi nama, email dan no. telefon dahulu.', eIsiUsd:'Isi nama, email dan no. telefon dahulu.',
    eEmail:'Email tidak sah. Semak semula.', eBesar:'Data terlalu besar (~{kb}KB). Guna gambar atau MP3 yang lebih kecil.',
    eBil:'Gagal cipta bil pembayaran. Cuba lagi.',
    sedia:'Menyediakan pembayaran...', bawa:'Membawa ke pembayaran...',
    pvMp3:'Pratonton dipaparkan tanpa muzik kerana fail terlalu besar. Muzik tetap ada dalam kad sebenar.',
    pvBesar:'Gambar terlalu besar untuk pratonton. Cuba guna gambar yang lebih kecil.',
    tq:'Terima kasih', tqS:'Kami sedang menyemak pembayaran dan menyediakan link kad anda.', bukan:'Bukan saya — kembali ke borang'
  },
  en:{
    ringkasan:'Order summary', kad:'Digital card', kuantiti:'Quantity', harga:'Price', jumlah:'Total',
    cara:'Accepted payment methods', fpx:'Online banking', qr:'DuitNow QR', kadkredit:'Credit / debit card',
    fee:'Payments via <b>DuitNow QR</b> carry a <b>RM1.00</b> processing fee from the payment provider, added to your total. <b>FPX</b> has no extra fee.',
    feeUsd:'Prices are in <b>US dollars (USD)</b>. Your bank may convert to your local currency.',
    nama:'Your name', namaPh:'e.g. Sarah Lee', tel:'Phone (WhatsApp)', telOpt:'Phone number', telPh:'e.g. +1 555 123 4567',
    email:'Email', emailPh:'e.g. sarah@gmail.com',
    hint:'Your receipt is sent to this email. Use the same email &amp; phone if you need to find your card link later.',
    hintUsd:'Your receipt is sent to this email. Keep this email &amp; phone number, you will need them to find your card link again on the Check My Cards page.',
    btn:'Pay &amp; get your card link', btnUsd:'Pay {harga} by card',
    safe:'Payments protected &amp; encrypted by ToyyibPay', safeUsd:'Card payments protected &amp; encrypted by Stripe',
    tip:'After paying, if your bank shows &quot;transaction is being processed&quot;, just tap <b>Close</b>. You will be taken back to your card link automatically.',
    tipUsd:'After paying, you will be taken straight to your card link.',
    mwT:'Paying from', mwMy:'🇲🇾 Malaysia', mwMyS:'RM · FPX / DuitNow', mwUs:'🌍 Outside Malaysia', mwUsS:'USD · card / Apple Pay',
    prev:'Preview your card — free', prevS:'See exactly how your card looks. No payment, no details needed.',
    eDb:'Could not connect to the database. Refresh the page and try again.',
    eIsi:'Please fill in your name, email and phone number first.', eIsiUsd:'Please fill in your name, email and phone number first.',
    eEmail:'That email doesn\'t look right. Please check it.', eBesar:'Your data is too large (~{kb}KB). Use smaller photos or MP3.',
    eBil:'Could not create the payment. Please try again.',
    sedia:'Preparing payment...', bawa:'Taking you to payment...',
    pvMp3:'Preview is shown without music because the file is too large. Music is still included in the real card.',
    pvBesar:'Photos are too large to preview. Try smaller photos.',
    tq:'Thank you', tqS:'We are confirming your payment and preparing your card link.', bukan:'Not me — back to the form'
  }
};
function L(){ var l='ms'; try{ l=localStorage.getItem('gk_lang')||'ms'; }catch(e){} return l==='en'?'en':'ms'; }
function t(k){ var d=T[L()]; return (d&&d[k]!=null)?d[k]:T.ms[k]; }

/* ───────── mata wang ───────── */
function diMalaysia(){
  try{ var z=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
       return z==='Asia/Kuala_Lumpur'||z==='Asia/Kuching'||z===''; }catch(e){ return true; }
}
var CUR='myr';
function mulaMatawang(){
  var q=null; try{ q=(new URLSearchParams(location.search).get('cur')||'').toLowerCase(); }catch(e){}
  if(q==='usd'||q==='myr'){ try{ localStorage.setItem('gk_cur',q); }catch(e){} return q; }
  var s=null; try{ s=localStorage.getItem('gk_cur'); }catch(e){}
  if(s==='usd'||s==='myr') return (s==='usd'&&!STRIPE_ON&&!ujian())?'myr':s;
  return (STRIPE_ON&&!diMalaysia())?'usd':'myr';
}
function ujian(){ try{ return localStorage.getItem('gk_cur_test')==='1'; }catch(e){ return false; } }
function usd(){ return CUR==='usd'; }
function hargaPlan(k){ var p=PLANS[k]; return usd() ? (p.usd!=null?p.usd:(USD_LALAI[k]!=null?USD_LALAI[k]:p.rm)) : p.rm; }
function fmt(n,panjang){ return usd() ? (panjang?'USD '+Number(n).toFixed(2):'$'+n) : (panjang?'RM'+Number(n).toFixed(2):'RM'+n); }
function namaPlan(k){ var p=PLANS[k]; if(L()!=='en') return p.nm; return p.nm_en||(EN_LALAI[k]&&EN_LALAI[k].nm)||p.nm; }
function descPlan(k){ var p=PLANS[k]; if(L()!=='en') return p.ds||''; return p.ds_en||(EN_LALAI[k]&&EN_LALAI[k].ds)||p.ds||''; }

var CSS=''
+'.gkb{font-family:inherit}'
+'.gkb-card{border:1.5px solid #e8dfe3;border-radius:16px;overflow:hidden;margin-top:14px;background:#fff}'
+'.gkb-card h4{margin:0;padding:13px 16px;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;'
+'font-weight:700;color:#8a7b82;background:#faf6f7;border-bottom:1.5px solid #e8dfe3}'
+'.gkb-line{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 16px;'
+'border-bottom:1px solid #f2eaee;font-size:.86rem}'
+'.gkb-line:last-child{border-bottom:none}'
+'.gkb-line .k{color:#7d6b73}'
+'.gkb-line .v{font-weight:600;text-align:right}'
+'.gkb-total{background:#faf6f7;padding:15px 16px;display:flex;justify-content:space-between;align-items:center}'
+'.gkb-total .k{font-size:.8rem;font-weight:600;color:#7d6b73}'
+'.gkb-total .v{font-size:1.5rem;font-weight:700;color:var(--gk-accent-2,#c2185b)}'
+'.gkb-plans{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}'
+'.gkb-plan{flex:1;min-width:150px;border:2px solid #e8dfe3;border-radius:14px;padding:14px 12px;cursor:pointer;'
+'transition:.2s;background:#fff;position:relative}'
+'.gkb-plan:hover{border-color:var(--gk-accent,#e91e63)}'
+'.gkb-plan.on{border-color:var(--gk-accent,#e91e63);box-shadow:0 0 0 3px rgba(0,0,0,.05)}'
+'.gkb-plan .rm{font-size:1.35rem;font-weight:700;color:var(--gk-accent-2,#c2185b);line-height:1}'
+'.gkb-plan .nm{font-size:.82rem;font-weight:600;margin-top:3px}'
+'.gkb-plan .ds{font-size:.68rem;color:#a2909a;margin-top:4px;line-height:1.45}'
+'.gkb-plan .tick{position:absolute;top:10px;right:10px;width:17px;height:17px;border-radius:50%;'
+'border:1.5px solid #ddd0d6;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#fff}'
+'.gkb-plan.on .tick{background:var(--gk-accent,#e91e63);border-color:var(--gk-accent,#e91e63)}'
+'.gkb-satu .gkb-plan{cursor:default}.gkb-satu .gkb-plan:hover{border-color:var(--gk-accent,#e91e63)}'
+'.gkb label{font-weight:600;font-size:.8rem;display:block;margin-top:13px;margin-bottom:4px}'
+'.gkb .gkb-hint{font-size:.72rem;color:#b3a3ab;display:block;margin-bottom:4px}'
+'.gkb input{width:100%;padding:11px 13px;border:1.5px solid #e8dfe3;border-radius:10px;font-family:inherit;'
+'font-size:.85rem;outline:none;transition:.2s;background:#fff;box-sizing:border-box}'
+'.gkb input:focus{border-color:var(--gk-accent,#e91e63);box-shadow:0 0 0 3px rgba(0,0,0,.05)}'
+'.gkb .gkb-row{display:flex;gap:12px;flex-wrap:wrap}.gkb .gkb-row>div{flex:1;min-width:170px}'
+'.gkb-ways{display:flex;gap:8px;flex-wrap:wrap;padding:13px 16px}'
+'.gkb-way{display:flex;align-items:center;gap:7px;border:1.5px solid #e8dfe3;border-radius:10px;'
+'padding:9px 12px;font-size:.76rem;font-weight:600;color:#5d4a53;background:#fff}'
+'.gkb-way i{font-style:normal;font-size:.62rem;letter-spacing:.06em;color:#fff;background:#1a4fa0;'
+'padding:3px 6px;border-radius:4px}'
+'.gkb-way.qr i{background:#c8102e}'
+'.gkb-way.kd i{background:#635bff}'
+'.gkb-way.ap i{background:#111}'
+'.gkb-fee{padding:0 16px 14px;font-size:.74rem;color:#8a7b82;line-height:1.6}'
+'.gkb-fee b{color:#5d4a53}'
+'.gkb-mw{display:flex;gap:6px;padding:5px;background:#f6f0f3;border-radius:14px;margin-top:4px}'
+'.gkb-mw button{flex:1;border:0;background:transparent;border-radius:10px;padding:10px 6px;font-family:inherit;cursor:pointer;'
+'font-size:.8rem;font-weight:700;color:#7d6b73;line-height:1.25;transition:.2s}'
+'.gkb-mw button small{display:block;font-size:.66rem;font-weight:500;opacity:.8;margin-top:2px}'
+'.gkb-mw button.on{background:#fff;color:var(--gk-accent-2,#c2185b);box-shadow:0 2px 8px rgba(0,0,0,.08)}'
+'.gkb-mw-t{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a7b82;margin:2px 2px 6px}'
+'gkb-tukar-lama{display:block;text-align:center;margin-top:10px;font-size:.76rem;color:#8a7b82;cursor:pointer;'
+'text-decoration:underline;text-underline-offset:3px;background:none;border:0;width:100%;font-family:inherit}'
+'.gkb-tukar b{color:var(--gk-accent-2,#c2185b)}'
+'.gkb-btn{width:100%;padding:16px;border:none;border-radius:12px;font-family:inherit;font-size:.95rem;'
+'font-weight:700;cursor:pointer;margin-top:14px;transition:.2s;color:#fff;'
+'background:linear-gradient(135deg,var(--gk-accent,#e91e63),var(--gk-accent-2,#c2185b))}'
+'.gkb-btn:hover{transform:translateY(-2px)}'
+'.gkb-btn:disabled{background:#ccc;transform:none;cursor:not-allowed}'
+'.gkb-btn.ghost{background:#fff;color:var(--gk-accent-2,#c2185b);border:2px solid var(--gk-accent,#e91e63)}'
+'.gkb-safe{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;'
+'font-size:.76rem;color:#5d8f6b}'
+'.gkb-safe svg{width:15px;height:15px;fill:#5d8f6b;flex-shrink:0}'
+'.gkb-msg{margin-top:14px;padding:13px 15px;border-radius:12px;font-size:.8rem;line-height:1.6;display:none;'
+'background:#ffebee;border:1.5px solid #ef9a9a;color:#c62828}'
+'.gkb-tip{margin-top:12px;padding:12px 14px;background:#fff8e1;border:1.5px solid #ffe0a3;border-radius:12px;'
+'font-size:.75rem;color:#8a6d00;line-height:1.6}'
+'.gkb [hidden]{display:none!important}';

function $(id){ return document.getElementById(id); }

function shield(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm-1.2 16-4-4 1.4-1.4 2.6 2.6 5.6-5.6L17.8 10l-7 7z"/></svg>';
}

/* Struktur dibina SEKALI sahaja — borang ada yang pegang #gkb-pay (disable/enable),
   jadi bila bahasa / mata wang bertukar kita cuma kemas kini teks, bukan bina semula. */
function build(){
  var qr = CFG.qr===true;
  var kunci=Object.keys(PLANS), satu=kunci.length===1;
  var h='<div id="gkb-mw-w" hidden><div class="gkb-mw-t" data-t="mwT"></div><div class="gkb-mw">'
    +'<button type="button" data-mw="myr"><span data-t="mwMy"></span><small data-t="mwMyS"></small></button>'
    +'<button type="button" data-mw="usd"><span data-t="mwUs"></span><small data-t="mwUsS"></small></button>'
    +'</div></div>';
  h+='<div class="gkb-plans'+(satu?' gkb-satu':'')+'">';
  kunci.forEach(function(k,i){
    h+='<div class="gkb-plan'+(i===0?' on':'')+'" data-plan="'+k+'">'+(satu?'':'<div class="tick">✓</div>')
      +'<div class="rm"></div><div class="nm"></div><div class="ds"></div></div>'; });
  h+='</div>'

  +'<div class="gkb-card">'
  +'  <h4 data-t="ringkasan"></h4>'
  +'  <div class="gkb-line"><span class="k" id="gkb-pnama"></span><span class="v" id="gkb-pplan"></span></div>'
  +'  <div class="gkb-line"><span class="k" data-t="kuantiti"></span><span class="v">1</span></div>'
  +'  <div class="gkb-line"><span class="k" data-t="harga"></span><span class="v" id="gkb-pharga"></span></div>'
  +'  <div class="gkb-total"><span class="k" data-t="jumlah"></span><span class="v" id="gkb-ptotal"></span></div>'
  +'</div>'

  +'<div class="gkb-card">'
  +'  <h4 data-t="cara"></h4>'
  +'  <div class="gkb-ways" data-cur="myr">'
  +'    <div class="gkb-way"><i>FPX</i> <span data-t="fpx"></span></div>'
  + (qr?'    <div class="gkb-way qr"><i>QR</i> <span data-t="qr"></span></div>':'')
  +'  </div>'
  +'  <div class="gkb-ways" data-cur="usd">'
  +'    <div class="gkb-way kd"><i>CARD</i> <span data-t="kadkredit"></span></div>'
  +'    <div class="gkb-way ap"><i>PAY</i> Apple Pay · Google Pay</div>'
  +'  </div>'
  + (qr?'  <div class="gkb-fee" data-cur="myr" data-t="fee"></div>':'')
  +'  <div class="gkb-fee" data-cur="usd" data-t="feeUsd"></div>'
  +'</div>'

  +'<label data-t="nama"></label>'
  +'<input type="text" id="gkb-name" data-ph="namaPh" autocomplete="name">'
  +'<div class="gkb-row">'
  +'  <div><label id="gkb-tel-l"></label><input type="tel" id="gkb-phone" data-ph="telPh" autocomplete="tel"></div>'
  +'  <div><label data-t="email"></label><input type="email" id="gkb-email" data-ph="emailPh" autocomplete="email"></div>'
  +'</div>'
  +'<span class="gkb-hint" id="gkb-hint"></span>'

  +'<button class="gkb-btn" id="gkb-pay"></button>'
  +'<div class="gkb-safe">'+shield()+'<span id="gkb-safe-t"></span></div>'
  +'<div class="gkb-msg" id="gkb-err"></div>'
  +'<div class="gkb-tip" id="gkb-tip"></div>';
  return h;
}

/* kemas kini semua teks ikut bahasa + mata wang semasa */
function terapkan(){
  var host=CFG._host; if(!host) return;
  var u=usd();
  host.querySelectorAll('[data-t]').forEach(function(e){ e.innerHTML=t(e.getAttribute('data-t')); });
  host.querySelectorAll('[data-ph]').forEach(function(e){ e.placeholder=t(e.getAttribute('data-ph')).replace(/&amp;/g,'&'); });
  host.querySelectorAll('[data-cur]').forEach(function(e){ e.hidden = e.getAttribute('data-cur')!==(u?'usd':'myr'); });
  host.querySelectorAll('.gkb-plan').forEach(function(p){
    var k=p.getAttribute('data-plan');
    p.querySelector('.rm').textContent=fmt(hargaPlan(k));
    p.querySelector('.nm').textContent=namaPlan(k);
    p.querySelector('.ds').textContent=descPlan(k);
  });
  $('gkb-tel-l').textContent = u ? t('telOpt') : t('tel');
  $('gkb-hint').innerHTML = u ? t('hintUsd') : t('hint');
  $('gkb-safe-t').innerHTML = u ? t('safeUsd') : t('safe');
  $('gkb-tip').innerHTML = u ? t('tipUsd') : t('tip');
  $('gkb-mw-w').hidden = !(STRIPE_ON || ujian() || u);
  host.querySelectorAll('[data-mw]').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mw')===(u?'usd':'myr')); });
  var btn=$('gkb-pay'); if(!btn.getAttribute('data-sibuk')) btn.innerHTML=teksButang();
  var pv=$('gkb-prev'); if(pv){ pv.textContent=t('prev'); var ps=$('gkb-prev-s'); if(ps) ps.textContent=t('prevS'); }
  paintSummary();
}

/* teks butang bayar. CFG.btn (cth 'Bayar RM3 &amp; download') dihormati untuk BM + RM;
   untuk USD / English kita jana versi setara. CFG.btn_en boleh ganti versi English. */
function teksButang(){
  var h=fmt(hargaPlan(plan())), en=L()==='en', b=CFG.btn;
  if(b){
    if(!usd() && !en) return b;
    var dl=/download/i.test(b);
    if(en) return CFG.btn_en ? CFG.btn_en.replace(/RM\s?\d+(\.\d+)?/,h) : (dl?'Pay '+h+' &amp; download':(usd()?t('btnUsd').replace('{harga}',h):t('btn')));
    return b.replace(/RM\s?\d+(\.\d+)?/,h);
  }
  return usd() ? t('btnUsd').replace('{harga}',h) : t('btn');
}

function showErr(msg){
  var e=$('gkb-err'); e.textContent=msg; e.style.display='block';
  e.scrollIntoView({behavior:'smooth',block:'center'});
}
function hideErr(){ var e=$('gkb-err'); if(e) e.style.display='none'; }

function plan(){
  var el=document.querySelector('.gkb-plan.on');
  return el?el.getAttribute('data-plan'):Object.keys(PLANS)[0];
}

function paintSummary(){
  var p=plan(), n=hargaPlan(p);
  var prod=CFG.produk || t('kad');
  if(L()==='en' && CFG.produk_en) prod=CFG.produk_en;
  $('gkb-pnama').textContent = prod;
  $('gkb-pplan').textContent = namaPlan(p);
  $('gkb-pharga').textContent = fmt(n,true);
  $('gkb-ptotal').textContent = fmt(n,true);
}

function preview(){
  var d=CFG.collect();
  try{
    localStorage.setItem('gk_preview',JSON.stringify(d));
  }catch(e1){
    try{
      var lite=JSON.parse(JSON.stringify(d)); lite.mp3='';
      localStorage.setItem('gk_preview',JSON.stringify(lite));
      alert(t('pvMp3'));
    }catch(e2){
      alert(t('pvBesar'));
      return;
    }
  }
  try{ localStorage.setItem('gk_back','1'); }catch(e3){}
  var base=location.href.split('#')[0].split('?')[0].replace(/[^/]*$/,'');
  window.open(base+CFG.viewer+'?preview=1','_blank');
}

function pay(){
  var btn=$('gkb-pay');
  hideErr();

  if(!db){ showErr(t('eDb')); return; }

  var u=usd();
  var name=$('gkb-name').value.trim();
  var email=$('gkb-email').value.trim();
  var phone=$('gkb-phone').value.trim();
  if(!name||!email||!phone){ showErr(u?t('eIsiUsd'):t('eIsi')); return; }
  if(!/^\S+@\S+\.\S+$/.test(email)){ showErr(t('eEmail')); return; }

  var d=CFG.collect();
  var kb=Math.round(JSON.stringify(d).length/1024);
  if(kb>4500){ showErr(t('eBesar').replace('{kb}',kb)); return; }

  var label=btn.innerHTML;
  btn.disabled=true; btn.setAttribute('data-sibuk','1'); btn.textContent=t('sedia');

  var ref=null;
  ref=refAktif();

  var laluan = u ? '/api/create-checkout' : '/api/create-bill';
  var kembali = location.href.split('#')[0].replace(/([?&])gk_batal=1&?/,'$1').replace(/[?&]$/,'');

  db.from('cards').insert([{
    card_data:d, paid:false, ref_code:ref,
    buyer_name:name, buyer_email:email, buyer_phone:phone
  }]).select().then(function(res){
    if(res.error) throw res.error;
    var id=res.data[0].id;
    return fetch(API_BASE+laluan,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({cardId:id, plan:plan(), buyerName:name, buyerEmail:email, buyerPhone:phone,
                           currency:u?'usd':'myr', returnUrl:kembali})
    }).then(function(r){ return r.json(); }).then(function(out){
      if(!out.paymentUrl) throw new Error(out.error||t('eBil'));
      try{ localStorage.setItem('gk_pending',id); }catch(e){}
      btn.textContent=t('bawa');
      location.href=out.paymentUrl;
    });
  }).catch(function(e){
    showErr(e.message||String(e));
    btn.disabled=false; btn.removeAttribute('data-sibuk'); btn.innerHTML=label;
  });
}

function pendingRedirect(){
  /* customer tekan "kembali" di halaman Stripe → jangan hantar ke bayar.html */
  var batal=false; try{ batal=new URLSearchParams(location.search).get('gk_batal')==='1'; }catch(e){}
  if(batal){ try{ localStorage.removeItem('gk_pending'); }catch(e){} return; }

  var id=null; try{ id=localStorage.getItem('gk_pending'); }catch(e){}
  if(!id) return;
  var b=document.createElement('div');
  b.style.cssText='position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;'
    +'align-items:center;justify-content:center;font-family:inherit;text-align:center;padding:26px;gap:10px';
  b.innerHTML='<div style="font-size:2.4rem">💌</div>'
    +'<div style="font-size:1.1rem;font-weight:700">'+t('tq')+'</div>'
    +'<div style="font-size:.88rem;color:#7a5666;max-width:320px;line-height:1.6">'+t('tqS')+'</div>'
    +'<div style="width:36px;height:36px;border:4px solid #eee;border-top-color:var(--gk-accent,#e91e63);'
    +'border-radius:50%;margin-top:12px;animation:gkspin 1s linear infinite"></div>'
    +'<style>@keyframes gkspin{to{transform:rotate(360deg)}}</style>'
    +'<div id="gkb-cancel" style="margin-top:16px;font-size:.78rem;color:#a89;text-decoration:underline;cursor:pointer">'+t('bukan')+'</div>';
  document.body.appendChild(b);
  var tm=setTimeout(function(){ location.href='bayar.html?id='+id; },1400);
  b.querySelector('#gkb-cancel').onclick=function(){
    clearTimeout(tm);
    try{ localStorage.removeItem('gk_pending'); }catch(e){}
    b.remove();
  };
}

/* ── kod affiliate: simpan dengan cap masa, luput selepas REF_HARI hari ──
   Link affiliate yang baru diklik sentiasa menang (klik terakhir). */
var REF_HARI=30;
function refAktif(){
  try{
    var q=new URLSearchParams(location.search).get('ref');
    if(q) return q.toUpperCase();
    var r=localStorage.getItem('gk_ref'); if(!r) return null;
    var t=+localStorage.getItem('gk_ref_t')||0;
    /* index.html & halaman lain simpan gk_ref tanpa tarikh. Kalau kod dah bertukar (atau tiada tarikh),
       anggap ia klik baru dan mula kira 30 hari dari sekarang. */
    if(!t || localStorage.getItem('gk_ref_c')!==r){
      localStorage.setItem('gk_ref_t',String(Date.now())); localStorage.setItem('gk_ref_c',r); return r; }
    if(Date.now()-t > REF_HARI*864e5){ localStorage.removeItem('gk_ref'); localStorage.removeItem('gk_ref_t'); return null; }
    return r;
  }catch(e){ return null; }
}
(function saveRef(){
  try{
    var ref=new URLSearchParams(location.search).get('ref');
    if(ref){ ref=ref.toUpperCase(); localStorage.setItem('gk_ref',ref); localStorage.setItem('gk_ref_t',String(Date.now())); localStorage.setItem('gk_ref_c',ref); }
    refAktif();
  }catch(e){}
  try{ var c=new URLSearchParams(location.search).get('cur'); if(c) localStorage.setItem('gk_cur_test','1'); }catch(e){}
})();

window.GKBayar={
  mount:function(cfg){
    CFG=cfg||{};
    PLANS=(CFG.plans&&Object.keys(CFG.plans).length)?CFG.plans:PLAN_LALAI;
    CUR=mulaMatawang();
    var host=(typeof CFG.el==='string')?$(CFG.el):CFG.el;
    if(!host) return;
    CFG._host=host;

    var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
    host.className=(host.className+' gkb').trim();
    host.innerHTML=build();

    host.querySelectorAll('.gkb-plan').forEach(function(p){
      if(Object.keys(PLANS).length===1){ p.style.cursor='default'; return; }
      p.onclick=function(){
        host.querySelectorAll('.gkb-plan').forEach(function(x){ x.classList.remove('on'); });
        p.classList.add('on');
        paintSummary();
        var btn=$('gkb-pay'); if(!btn.getAttribute('data-sibuk')) btn.innerHTML=teksButang();
      };
    });
    $('gkb-pay').onclick=pay;
    host.querySelectorAll('[data-mw]').forEach(function(b){
      b.onclick=function(){
        CUR = b.getAttribute('data-mw');
        try{ localStorage.setItem('gk_cur',CUR); }catch(e){}
        hideErr(); terapkan();
      };
    });

    /* butang pratonton berasingan — diletak lebih awal dalam borang */
    var pv=(typeof CFG.previewEl==='string')?$(CFG.previewEl):CFG.previewEl;
    if(pv){
      pv.className=(pv.className+' gkb').trim();
      pv.innerHTML='<button class="gkb-btn ghost" id="gkb-prev" style="margin-top:6px"></button>'
        +'<p id="gkb-prev-s" style="text-align:center;font-size:.74rem;color:#a2909a;margin-top:8px"></p>';
      $('gkb-prev').onclick=preview;
    }

    terapkan();
    pendingRedirect();

    /* ikut bahasa borang: bila customer tekan BM/EN, borang tulis 'gk_lang' */
    var lepas=L();
    setInterval(function(){ var k=L(); if(k!==lepas){ lepas=k; terapkan(); } },600);
  },
  lang:function(){ terapkan(); },
  currency:function(){ return CUR; },
  buyer:function(){
    return { name:$('gkb-name').value.trim(), email:$('gkb-email').value.trim(),
             phone:$('gkb-phone').value.trim(), plan:plan(), currency:CUR };
  }
};
})();
