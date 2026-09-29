/* ══════════════════════════════════════════════════════════
   GiftKita — 📥 DOWNLOAD ALBUM (ciri Premium)
   Muat turun SATU fail .html yang sebijik macam link kad (animasi,
   gambar, ucapan). Kekal dalam phone customer walaupun link dah tamat
   (link aktif 2 bulan). Tak guna storan Supabase: data kad ditanam
   dalam fail & supabase-js diganti "shim" palsu.
   (Album PDF lama DIBUANG 30 Sep — diganti ciri ni.)

   Viewer panggil GKAlbum.init(...) bila kad siap dipaparkan; sesetengah
   viewer ada menu yang panggil GKAlbum.open(). Butang hanya muncul untuk
   kad PREMIUM (lajur cards.plan) yang dibayar & belum tamat.
   ══════════════════════════════════════════════════════════ */
(function(){
  const OFFLINE=!!window.GK_SIMPAN;               // fail album yang dah disimpan dalam phone
  const EN=()=>{try{return localStorage.getItem('gk_lang')==='en'}catch(e){return false}};
  const LABEL=()=>EN()?'📥 Download Album':'📥 Download Album';
  let premium=false, mintaInit=false;

  const SHIM="window.GK_SIMPAN=1;(function(){var U=window.URLSearchParams;"
   +"function P(s){var u=new U(s);if(!u.get('id'))u.set('id','simpan');u.delete('preview');return u;}"
   +"P.prototype=U.prototype;window.URLSearchParams=P;"
   +"var R={data:{id:'simpan',paid:true,card_data:null},error:null};"
   +"function q(){var p=new Proxy(function(){},{get:function(t,k){"
   +"if(k==='then')return function(a,b){R.data.card_data=window.__GKD;return Promise.resolve(R).then(a,b);};"
   +"if(k==='catch'||k==='finally')return function(f){return Promise.resolve(R)[k](f);};"
   +"return function(){return p;};},apply:function(){return p;}});return p;}"
   +"window.supabase={createClient:function(){return q();}};})();";

  const selamat=t=>String(t).replace(/<\/script/gi,'<\\/script');
  const jsonSelamat=o=>JSON.stringify(o).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const keDataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});

  async function tanamFont(h){
    const links=[...h.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"[^>]*>/g)];
    for(const m of links){
      try{
        const css=await (await fetch(m[1].replace(/&amp;/g,'&'))).text();
        const latin=css.split(/(?=\/\* )/).filter(b=>/^\/\* latin \*\//.test(b));
        let out=latin.length?latin.join('\n'):css;
        const urls=[...new Set([...out.matchAll(/url\((https:[^)]+)\)/g)].map(x=>x[1]))];
        for(const u of urls){ const d=await keDataURL(await (await fetch(u)).blob()); out=out.split(u).join(d); }
        h=h.replace(m[0],()=>'<style>'+out+'</style>');
      }catch(e){ /* tiada internet → biar link font asal */ }
    }
    return h;
  }

  async function jadikanFail(){
    const id=new URLSearchParams(location.search).get('id');
    const cli=(typeof db!=='undefined'&&db)?db:null;
    if(!id||!cli||!premium) throw new Error('bukan kad premium');
    const r=await cli.from('cards').select('card_data,paid').eq('id',id).single();
    if(r.error||!r.data||!r.data.card_data) throw new Error('tak dapat baca kad');
    const cd=r.data.card_data;

    let h=await (await fetch(location.pathname,{cache:'no-cache'})).text();
    h=h.replace(/<script[^>]*supabase-js[^>]*><\/script>\s*/gi,'');
    h=h.replace(/<script>if\(!window\.supabase\)[\s\S]*?<\/script>\s*/,'');
    h=h.replace(/<link[^>]+rel="manifest"[^>]*>\s*/gi,'');
    for(const f of ['album.js','lightbox.js']){
      const tag='<script src="'+f+'"></script>';
      if(h.includes(tag)){
        const t=await (await fetch('/'+f,{cache:'no-cache'})).text();
        h=h.split(tag).join('<script>'+selamat(t)+'</script>');
      }
    }
    h=await tanamFont(h);
    const inj='<script>window.__GKD='+jsonSelamat(cd)+';'+SHIM+'</script>';
    h=h.replace(/<head[^>]*>/i,m=>m+inj);

    const nama=String(cd.nama||cd.name||cd.to||'').replace(/[^\w\u00C0-\u024F ]/g,'').trim().slice(0,24);
    return {html:h, nama:'Album GiftKita'+(nama?' - '+nama:'')+'.html'};
  }


  /* ── butang ── */
  function makeBtn(){
    if(OFFLINE||!premium||document.getElementById('gk-album-btn')) return;
    const b=document.createElement('button');
    b.id='gk-album-btn';
    b.innerHTML=LABEL();
    b.style.cssText=`position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 54px);
      z-index:400;background:linear-gradient(135deg,#e91e63,#a8121c);color:#fff;border:none;
      border-radius:40px;padding:11px 17px;font-family:Poppins,sans-serif;font-size:.72rem;
      font-weight:600;letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35)`;
    b.onclick=bukaPanel;
    document.body.appendChild(b);
  }

  function toast(t){
    const d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99999;background:rgba(40,10,25,.9);color:#fff;font:500 .78rem Poppins,sans-serif;padding:10px 16px;border-radius:20px;max-width:86%;text-align:center';
    d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),2800);
  }

  async function muatTurun(btn0){
    const btn=btn0.querySelector('b')||btn0;
    const asal=btn.innerHTML; btn0.disabled=true; btn.innerHTML=EN()?'⏳ Preparing...':'⏳ Menyediakan...';
    try{
      const f=await jadikanFail();
      const url=URL.createObjectURL(new Blob([f.html],{type:'text/html'}));
      const a=document.createElement('a'); a.href=url; a.download=f.nama; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      btn.innerHTML=EN()?'✅ Done! Check Downloads':'✅ Siap! Semak folder Download';
    }catch(e){
      console.error(e); btn.innerHTML=EN()?'❌ Failed — try again':'❌ Gagal — cuba lagi';
    }
    setTimeout(()=>{btn.innerHTML=asal;btn0.disabled=false;},3500);
  }

  function bukaPanel(){
    if(document.getElementById('gk-simpan-sheet')) return;
    const en=EN();
    const o=document.createElement('div'); o.id='gk-simpan-sheet';
    o.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(20,5,12,.55);display:flex;align-items:flex-end;justify-content:center;font-family:Poppins,sans-serif';
    o.innerHTML=`<div style="background:#fff;width:100%;max-width:440px;border-radius:22px 22px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 18px);box-shadow:0 -10px 40px rgba(0,0,0,.25)">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:1rem;color:#c2185b">📥 Download Album 💝</b>
        <button data-k="x" style="border:none;background:none;font-size:1.4rem;cursor:pointer;color:#a08">×</button></div>
      <p style="font-size:.78rem;color:#5a3a48;line-height:1.55;margin:8px 2px 0">${en
        ?'Save this card to your phone — <b>exactly like the link</b>: animations, photos & wishes. It stays forever, even after the link expires.'
        :'Simpan kad ni dalam phone — <b>sebijik macam link</b>: animasi, gambar & ucapan. Kekal selamanya walaupun link dah tamat.'}</p>
      <button data-k="dl" style="display:block;width:100%;margin-top:12px;background:linear-gradient(135deg,#e91e63,#a8121c);color:#fff;border:none;border-radius:14px;padding:14px;font:600 .9rem Poppins,sans-serif;cursor:pointer"><b>${en?'⬇️ Download now':'⬇️ Download sekarang'}</b></button>
      <p style="font-size:.68rem;color:#8a6d7a;line-height:1.55;margin:12px 2px 0">${en
        ?'📱 To open: tap the file in Downloads and open it with <b>Chrome</b> (Android) or <b>Safari</b> (iPhone: Files → hold the file → Share → Safari). To send, use WhatsApp → <b>Document</b>. Music needs internet.'
        :'📱 Nak buka: tekan fail dalam Download & buka guna <b>Chrome</b> (Android) atau <b>Safari</b> (iPhone: Files → tekan lama fail → Kongsi → Safari). Nak hantar, guna WhatsApp → <b>Dokumen</b>. Lagu perlukan internet.'}</p>
    </div>`;
    o.addEventListener('click',e=>{
      const b=e.target.closest('button'); if(e.target===o||(b&&b.dataset.k==='x')){o.remove();return;}
      if(b&&b.dataset.k==='dl') muatTurun(b);
    });
    document.body.appendChild(o);
  }

  window.GKAlbum={
    init(){ mintaInit=true; makeBtn(); },
    open(){
      if(OFFLINE) return toast(EN()?'This is your saved album 💝':'Ni album simpanan kamu 💝');
      if(premium) return bukaPanel();
      toast(EN()?'Download Album is a Premium feature 💝':'Download Album untuk pakej Premium 💝');
    },
    simpan:jadikanFail
  };

  /* Semak pelan kad selepas load. Premium + dibayar + belum tamat → butang muncul
     bila viewer panggil init (kad siap), atau terus kalau viewer tak pernah
     panggil init (cth. Capit). */
  if(!OFFLINE) window.addEventListener('load',()=>setTimeout(async()=>{
    const id=new URLSearchParams(location.search).get('id');
    const cli=(typeof db!=='undefined'&&db)?db:null;
    if(!id||!cli) return;
    try{
      const r=await cli.from('cards').select('plan,paid,card_data->tamat').eq('id',id).single();
      const d=r&&r.data; if(!d||d.plan!=='premium'||d.paid!==true||d.tamat) return;
      premium=true;
      const adaInit=[...document.scripts].some(x=>/GKAlbum\.(init|open)/.test(x.textContent||''));   // viewer ada pintu sendiri
      if(mintaInit||!adaInit) makeBtn();   // viewer tanpa init (cth. Capit) → terus pasang
    }catch(e){}
  },1500));
})();
