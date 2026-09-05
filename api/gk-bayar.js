/* ══════════════════════════════════════════════════════════════
   GiftKita — Enjin Bayaran Bersama
   Satu file untuk SEMUA borang kad. Betulkan bug sekali,
   semua borang dapat pembetulan.

   Cara guna dalam borang:
     <div id="gk-bayar"></div>
     <script src="gk-bayar.js"></script>
     <script>
       GKBayar.mount({
         el:'gk-bayar',
         viewer:'card-couple-1.html',
         collect:collectData          // fungsi yang pulangkan objek data kad
       });
     </script>

   Warna butang ikut tema borang melalui CSS variable:
     --gk-accent  dan  --gk-accent-2
   ══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var SB_URL='https://lejpuajafuenlfvlovfg.supabase.co';
var SB_KEY='sb_publishable_igFE4w_dz4ZF99wH1LeBKg_JL5kFoZ0';
var API_BASE=(location.hostname.indexOf('github.io')>-1)?'https://www.giftkita.com':'';

var db=null;
try{ if(window.supabase&&window.supabase.createClient) db=window.supabase.createClient(SB_URL,SB_KEY); }catch(e){ db=null; }

var CFG={};

var CSS=''
+'.gkb label{font-weight:600;font-size:.8rem;display:block;margin-top:12px;margin-bottom:4px}'
+'.gkb .gkb-hint{font-size:.72rem;color:#b3a3ab;display:block;margin-bottom:4px}'
+'.gkb input{width:100%;padding:11px 13px;border:1.5px solid #e8dfe3;border-radius:10px;font-family:inherit;font-size:.85rem;outline:none;transition:.2s;background:#fff}'
+'.gkb input:focus{border-color:var(--gk-accent,#e91e63);box-shadow:0 0 0 3px rgba(0,0,0,.05)}'
+'.gkb .gkb-row{display:flex;gap:12px;flex-wrap:wrap}.gkb .gkb-row>div{flex:1;min-width:170px}'
+'.gkb .gkb-plans{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}'
+'.gkb .gkb-plan{flex:1;min-width:140px;border:2px solid #e8dfe3;border-radius:14px;padding:14px 10px;text-align:center;cursor:pointer;transition:.2s;background:#fff}'
+'.gkb .gkb-plan.on{border-color:var(--gk-accent,#e91e63);box-shadow:0 0 0 3px rgba(0,0,0,.05)}'
+'.gkb .gkb-plan b{display:block;font-size:1.5rem;color:var(--gk-accent-2,#c2185b)}'
+'.gkb .gkb-plan i{display:block;font-style:normal;font-size:.78rem;font-weight:600;margin-top:2px}'
+'.gkb .gkb-plan span{display:block;font-size:.66rem;color:#a99;margin-top:3px;line-height:1.4}'
+'.gkb .gkb-btn{width:100%;padding:15px;border:none;border-radius:12px;font-family:inherit;font-size:.95rem;font-weight:700;cursor:pointer;margin-top:16px;transition:.2s;color:#fff;background:linear-gradient(135deg,var(--gk-accent,#e91e63),var(--gk-accent-2,#c2185b))}'
+'.gkb .gkb-btn:hover{transform:translateY(-2px)}'
+'.gkb .gkb-btn:disabled{background:#ccc;transform:none;cursor:not-allowed}'
+'.gkb .gkb-btn.ghost{background:#fff;color:var(--gk-accent-2,#c2185b);border:2px solid var(--gk-accent,#e91e63)}'
+'.gkb .gkb-msg{margin-top:14px;padding:13px 15px;border-radius:12px;font-size:.8rem;line-height:1.6;display:none}'
+'.gkb .gkb-err{background:#ffebee;border:1.5px solid #ef9a9a;color:#c62828}'
+'.gkb .gkb-tip{margin-top:12px;padding:12px 14px;background:#fff8e1;border:1.5px solid #ffe0a3;border-radius:12px;font-size:.75rem;color:#8a6d00;line-height:1.6}'
+'.gkb .gkb-sec{padding-top:6px}';

var HTML=''
+'<div class="gkb-sec">'
+'  <label>Nama anda</label>'
+'  <input type="text" id="gkb-name" placeholder="cth: Aina Sofea">'
+'  <div class="gkb-row">'
+'    <div><label>No. telefon (WhatsApp)</label><input type="text" id="gkb-phone" placeholder="cth: 0123456789"></div>'
+'    <div><label>Email</label><input type="text" id="gkb-email" placeholder="cth: aina@gmail.com"></div>'
+'  </div>'
+'  <span class="gkb-hint">Resit dihantar ke email ini. Guna email &amp; telefon yang sama jika anda perlu cari semula link kad nanti.</span>'
+'  <div class="gkb-plans">'
+'    <div class="gkb-plan on" data-plan="basic"><b>RM6</b><i>Basic</i><span>Muzik YouTube</span></div>'
+'    <div class="gkb-plan" data-plan="premium"><b>RM8</b><i>Premium</i><span>MP3 sendiri · kod QR · album PDF</span></div>'
+'  </div>'
+'  <button class="gkb-btn ghost" id="gkb-prev">Lihat kad dulu — percuma</button>'
+'  <button class="gkb-btn" id="gkb-pay">Bayar &amp; dapatkan link kad</button>'
+'  <div class="gkb-msg gkb-err" id="gkb-err"></div>'
+'  <div class="gkb-tip">Selepas bayar, jika bank papar &quot;transaction is being processed&quot;, tekan <b>Close</b> sahaja. Anda akan dibawa kembali ke halaman link kad secara automatik.</div>'
+'</div>';

function $(id){ return document.getElementById(id); }

function showErr(msg){
  var e=$('gkb-err'); e.textContent=msg; e.style.display='block';
  e.scrollIntoView({behavior:'smooth',block:'center'});
}
function hideErr(){ var e=$('gkb-err'); if(e) e.style.display='none'; }

function plan(){
  var el=document.querySelector('.gkb-plan.on');
  return el?el.getAttribute('data-plan'):'basic';
}

/* ── pratonton percuma ── */
function preview(){
  var d=CFG.collect();
  try{
    localStorage.setItem('gk_preview',JSON.stringify(d));
  }catch(e1){
    try{
      var lite=JSON.parse(JSON.stringify(d)); lite.mp3='';
      localStorage.setItem('gk_preview',JSON.stringify(lite));
      alert('Pratonton dipaparkan tanpa muzik kerana fail terlalu besar. Muzik tetap ada dalam kad sebenar.');
    }catch(e2){
      alert('Gambar terlalu besar untuk pratonton. Cuba guna gambar yang lebih kecil.');
      return;
    }
  }
  try{ localStorage.setItem('gk_back','1'); }catch(e3){}
  var base=location.href.split('#')[0].split('?')[0].replace(/[^/]*$/,'');
  window.open(base+CFG.viewer+'?preview=1','_blank');
}

/* ── bayar ── */
function pay(){
  var btn=$('gkb-pay');
  hideErr();

  if(!db){ showErr('Sambungan ke pangkalan data gagal. Refresh halaman dan cuba lagi.'); return; }

  var name=$('gkb-name').value.trim();
  var email=$('gkb-email').value.trim();
  var phone=$('gkb-phone').value.trim();
  if(!name||!email||!phone){ showErr('Isi nama, email dan no. telefon dahulu.'); return; }
  if(!/^\S+@\S+\.\S+$/.test(email)){ showErr('Email tidak sah. Semak semula.'); return; }

  var d=CFG.collect();
  var kb=Math.round(JSON.stringify(d).length/1024);
  if(kb>4500){ showErr('Data terlalu besar (~'+kb+'KB). Guna gambar atau MP3 yang lebih kecil.'); return; }

  var label=btn.textContent;
  btn.disabled=true; btn.textContent='Menyediakan pembayaran...';

  var ref=null;
  try{ ref=new URLSearchParams(location.search).get('ref')||localStorage.getItem('gk_ref')||null; }catch(e){}

  db.from('cards').insert([{
    card_data:d, paid:false, ref_code:ref,
    buyer_name:name, buyer_email:email, buyer_phone:phone
  }]).select().then(function(res){
    if(res.error) throw res.error;
    var id=res.data[0].id;
    return fetch(API_BASE+'/api/create-bill',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({cardId:id, plan:plan(), buyerName:name, buyerEmail:email, buyerPhone:phone})
    }).then(function(r){ return r.json(); }).then(function(out){
      if(!out.paymentUrl) throw new Error(out.error||'Gagal cipta bil pembayaran. Cuba lagi.');
      try{ localStorage.setItem('gk_pending',id); }catch(e){}
      btn.textContent='Membawa ke pembayaran...';
      location.href=out.paymentUrl;
    });
  }).catch(function(e){
    showErr(e.message||String(e));
    btn.disabled=false; btn.textContent=label;
  });
}

/* ── selepas balik dari ToyyibPay ── */
function pendingRedirect(){
  var id=null; try{ id=localStorage.getItem('gk_pending'); }catch(e){}
  if(!id) return;
  var b=document.createElement('div');
  b.style.cssText='position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;'
    +'align-items:center;justify-content:center;font-family:inherit;text-align:center;padding:26px;gap:10px';
  b.innerHTML='<div style="font-size:2.4rem">💌</div>'
    +'<div style="font-size:1.1rem;font-weight:700">Terima kasih</div>'
    +'<div style="font-size:.88rem;color:#7a5666;max-width:320px;line-height:1.6">Kami sedang menyemak pembayaran dan menyediakan link kad anda.</div>'
    +'<div style="width:36px;height:36px;border:4px solid #eee;border-top-color:var(--gk-accent,#e91e63);'
    +'border-radius:50%;margin-top:12px;animation:gkspin 1s linear infinite"></div>'
    +'<style>@keyframes gkspin{to{transform:rotate(360deg)}}</style>'
    +'<div id="gkb-cancel" style="margin-top:16px;font-size:.78rem;color:#a89;text-decoration:underline;cursor:pointer">Bukan saya — kembali ke borang</div>';
  document.body.appendChild(b);
  var t=setTimeout(function(){ location.href='bayar.html?id='+id; },1400);
  b.querySelector('#gkb-cancel').onclick=function(){
    clearTimeout(t);
    try{ localStorage.removeItem('gk_pending'); }catch(e){}
    b.remove();
  };
}

/* ── simpan kod affiliate ── */
(function saveRef(){
  try{
    var ref=new URLSearchParams(location.search).get('ref');
    if(ref) localStorage.setItem('gk_ref',ref.toUpperCase());
  }catch(e){}
})();

window.GKBayar={
  mount:function(cfg){
    CFG=cfg;
    var host=(typeof cfg.el==='string')?$(cfg.el):cfg.el;
    if(!host){ return; }
    var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
    host.className=(host.className+' gkb').trim();
    host.innerHTML=HTML;

    document.querySelectorAll('.gkb-plan').forEach(function(p){
      p.onclick=function(){
        document.querySelectorAll('.gkb-plan').forEach(function(x){ x.classList.remove('on'); });
        p.classList.add('on');
      };
    });
    $('gkb-prev').onclick=preview;
    $('gkb-pay').onclick=pay;

    pendingRedirect();
  },
  /* borang boleh guna semula untuk simpan/pulih draf pembeli */
  buyer:function(){
    return { name:$('gkb-name').value.trim(), email:$('gkb-email').value.trim(), phone:$('gkb-phone').value.trim(), plan:plan() };
  }
};
})();
