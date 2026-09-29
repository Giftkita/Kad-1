/* ══════════════════════════════════════════════════════════
   GiftKita — Album PDF (ciri Premium)
   Guna: GKAlbum.init(D)   selepas kad selesai dipaparkan
   Muat library hanya bila pengguna tekan butang (jimat data)
   ══════════════════════════════════════════════════════════ */
(function(){
  const LIBS=[
    ['html2canvas','https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
                   'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'],
    ['jspdf','https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
             'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js']
  ];
  let D={}, busy=false, hanyaSimpan=false, premium=false;
  const OFFLINE=!!window.GK_SIMPAN;               // fail kad yang dah disimpan dalam phone
  const EN=()=>{try{return localStorage.getItem('gk_lang')==='en'}catch(e){return false}};
  const LABEL=()=>(OFFLINE||!premium)?(EN()?'📕 Download Album':'📕 Muat Turun Album'):(EN()?'💾 Save Card':'💾 Simpan Kad');

  function load(src){
    return new Promise((res,rej)=>{
      const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
  }
  async function ensureLibs(){
    if(!window.html2canvas){
      try{ await load(LIBS[0][1]); }catch(e){ await load(LIBS[0][2]); }
    }
    if(!(window.jspdf&&window.jspdf.jsPDF)){
      try{ await load(LIBS[1][1]); }catch(e){ await load(LIBS[1][2]); }
    }
  }

  /* ── butang ── */
  function makeBtn(){
    if(document.getElementById('gk-album-btn')) return;
    const b=document.createElement('button');
    b.id='gk-album-btn';
    b.innerHTML=LABEL();
    b.style.cssText=`position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 54px);
      z-index:400;background:linear-gradient(135deg,#e91e63,#a8121c);color:#fff;border:none;
      border-radius:40px;padding:11px 17px;font-family:Poppins,sans-serif;font-size:.72rem;
      font-weight:600;letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35)`;
    b.onclick=()=>(premium&&!OFFLINE)?bukaPilihan():build();
    document.body.appendChild(b);
  }
  function setBtn(t,dis){
    const b=document.getElementById('gk-album-btn'); if(!b)return;
    b.innerHTML=t; b.disabled=!!dis; b.style.opacity=dis?'.65':'1';
  }

  /* ── halaman album ── */
  const PAGE_W=760, PAGE_H=1075;   // nisbah A4
  function page(inner,bg){
    const d=document.createElement('div');
    d.className='gk-pg';
    d.style.cssText=`width:${PAGE_W}px;height:${PAGE_H}px;background:${bg||'#fdfaf2'};
      position:relative;overflow:hidden;font-family:Poppins,sans-serif;color:#33201d;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:70px 60px;text-align:center;box-sizing:border-box`;
    d.innerHTML=inner;
    return d;
  }
  const esc=s=>String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const script=`font-family:'Great Vibes','Dancing Script',cursive`;

  function buildPages(){
    const P=[];
    const t=esc(D.title||'Happy Birthday'), sub=esc(D.subtitle||'');

    /* 1 — muka depan */
    P.push(page(`
      <div style="position:absolute;inset:26px;border:2px solid rgba(168,18,28,.35)"></div>
      <div style="font-size:60px;margin-bottom:26px">💝</div>
      <div style="${script};font-size:76px;color:#a8121c;line-height:1.05">${t}</div>
      <div style="font-size:20px;letter-spacing:.24em;text-transform:uppercase;color:#9c6a6a;margin-top:22px">${sub}</div>
      <div style="position:absolute;bottom:56px;font-size:13px;letter-spacing:.3em;color:#c39;text-transform:uppercase">GiftKita</div>
    `));

    /* 2 — doa / kata-kata */
    const w=(D.wishes||'').split('\n').map(x=>x.trim()).filter(Boolean);
    if(w.length){
      P.push(page(`
        <div style="${script};font-size:52px;color:#a8121c;margin-bottom:44px">Doa &amp; Harapan</div>
        <div style="text-align:left;max-width:520px">
          ${w.map((x,i)=>`<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:22px">
            <div style="min-width:34px;height:34px;border-radius:50%;background:#a8121c;color:#fff;
              display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700">${i+1}</div>
            <div style="font-size:19px;line-height:1.62;color:#4a3330">${esc(x)}</div></div>`).join('')}
        </div>
      `));
    }

    /* 3 — surat */
    if(D.story){
      P.push(page(`
        <div style="${script};font-size:52px;color:#a8121c;margin-bottom:36px">Surat Untuk Kamu</div>
        <div style="font-family:'Caveat',cursive;font-size:27px;line-height:1.68;color:#33201d;
          white-space:pre-line;text-align:left;max-width:540px">${esc(D.story)}</div>
      `));
    }

    /* 4 — gambar kenangan */
    const imgs=[D.p1_img,D.p2_img,D.p3_img,D.p4_img,D.p5_img,D.p6_img,D.story_img,D.cake_img]
      .filter(Boolean).slice(0,6);
    if(imgs.length){
      P.push(page(`
        <div style="${script};font-size:52px;color:#a8121c;margin-bottom:40px">Kenangan Kita</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:22px;width:100%;max-width:560px">
          ${imgs.map(s=>`<div style="background:#fff;padding:10px 10px 30px;box-shadow:0 6px 16px rgba(0,0,0,.14)">
            <img src="${s}" style="width:100%;height:190px;object-fit:cover;display:block">
          </div>`).join('')}
        </div>
      `));
    }

    /* 5 — petikan + kejutan */
    if(D.quote||D.surprise_msg){
      P.push(page(`
        <div style="font-size:96px;${script};color:rgba(168,18,28,.28);line-height:.4;margin-bottom:30px">&rdquo;</div>
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:40px;
          line-height:1.4;color:#a8121c;max-width:560px">${esc(D.quote||D.surprise_msg)}</div>
        ${D.author?`<div style="margin-top:34px;font-size:15px;letter-spacing:.26em;
          text-transform:uppercase;color:#9c6a6a">${esc(D.author)}</div>`:''}
        ${(D.quote&&D.surprise_msg)?`<div style="margin-top:44px;font-size:19px;color:#4a3330;
          max-width:520px;line-height:1.6">${esc(D.surprise_msg)}</div>`:''}
      `));
    }

    /* 6 — penutup */
    P.push(page(`
      <div style="position:absolute;inset:26px;border:2px solid rgba(255,255,255,.3)"></div>
      <div style="font-size:52px;margin-bottom:24px">🤍</div>
      <div style="${script};font-size:56px;color:#fff;line-height:1.1">Dengan sepenuh hati</div>
      <div style="font-size:15px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-top:26px">giftkita.com</div>
    `,'linear-gradient(160deg,#8c0d16,#a8121c 55%,#c4262f)'));

    return P;
  }

  /* ── jana PDF ── */
  async function build(){
    if(busy) return; busy=true;
    setBtn('⏳ Menyediakan...',true);
    try{
      await ensureLibs();

      const stage=document.createElement('div');
      stage.style.cssText='position:fixed;left:-99999px;top:0;z-index:-1';
      document.body.appendChild(stage);

      const pages=buildPages();
      pages.forEach(p=>stage.appendChild(p));
      await new Promise(r=>setTimeout(r,350));   // beri masa gambar & font

      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({unit:'px',format:[PAGE_W,PAGE_H],orientation:'portrait'});

      for(let i=0;i<pages.length;i++){
        setBtn(`⏳ ${i+1}/${pages.length}`,true);
        const cv=await html2canvas(pages[i],{scale:2,useCORS:true,backgroundColor:null,logging:false});
        const img=cv.toDataURL('image/jpeg',0.9);
        if(i) pdf.addPage([PAGE_W,PAGE_H],'portrait');
        pdf.addImage(img,'JPEG',0,0,PAGE_W,PAGE_H);
      }

      const name=(D.title||'GiftKita').replace(/[^\w\u00C0-\u024F ]/g,'').trim().slice(0,28)||'GiftKita';
      pdf.save(name+' - Album.pdf');
      stage.remove();
      setBtn('✅ Siap!',false);
      setTimeout(()=>setBtn(LABEL(),false),2600);
    }catch(e){
      console.error(e);
      setBtn('❌ Gagal — cuba lagi',false);
      setTimeout(()=>setBtn(LABEL(),false),3000);
    }
    busy=false;
  }

  /* ══════════════════════════════════════════════════════════
     💾 SIMPAN KAD — muat turun SATU fail .html yang sebijik macam
     link kad (animasi, gambar, ucapan). Kekal dalam phone customer
     walaupun link dah tamat (link aktif 2 bulan). Tak guna storan
     Supabase. Fail tu tak panggil pangkalan data langsung: data kad
     ditanam dalam fail, supabase-js diganti "shim" palsu.
     ══════════════════════════════════════════════════════════ */
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
    return {html:h, nama:'Kad GiftKita'+(nama?' - '+nama:'')+'.html'};
  }

  async function simpanKad(btn0){
    const btn=btn0.querySelector('b')||btn0;
    const asal=btn.innerHTML; btn0.disabled=true; btn.innerHTML=EN()?'⏳ Preparing...':'⏳ Menyediakan...';
    try{
      const f=await jadikanFail();
      const url=URL.createObjectURL(new Blob([f.html],{type:'text/html'}));
      const a=document.createElement('a'); a.href=url; a.download=f.nama; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      btn.innerHTML=EN()?'✅ Saved! Check Downloads':'✅ Siap! Semak folder Download';
    }catch(e){
      console.error(e); btn.innerHTML=EN()?'❌ Failed — try again':'❌ Gagal — cuba lagi';
    }
    setTimeout(()=>{btn.innerHTML=asal;btn0.disabled=false;},3500);
  }

  function bukaPilihan(){
    if(document.getElementById('gk-simpan-sheet')) return;
    const en=EN();
    const o=document.createElement('div'); o.id='gk-simpan-sheet';
    o.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(20,5,12,.55);display:flex;align-items:flex-end;justify-content:center;font-family:Poppins,sans-serif';
    const pil=(ic,t,d)=>`<button data-k="${ic}" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:#fff5f9;border:1.5px solid #f8bbd0;border-radius:14px;padding:12px 14px;margin-top:10px;cursor:pointer;font:inherit;color:#3a1a28">
        <span style="font-size:1.6rem">${ic}</span><span><b style="font-size:.9rem">${t}</b><br><span style="font-size:.72rem;color:#8a6d7a;line-height:1.45">${d}</span></span></button>`;
    o.innerHTML=`<div style="background:#fff;width:100%;max-width:440px;border-radius:22px 22px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 18px);box-shadow:0 -10px 40px rgba(0,0,0,.25)">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:1rem;color:#c2185b">${en?'Keep this card 💝':'Simpan kad ni 💝'}</b>
        <button data-k="x" style="border:none;background:none;font-size:1.4rem;cursor:pointer;color:#a08">×</button></div>
      ${pil('💾',en?'Save card (file)':'Simpan kad (fail)',en?'Exactly like the link — animations, photos & wishes. Stays on your phone forever, even after the link expires.':'Sebijik macam link — animasi, gambar & ucapan. Kekal dalam phone selamanya walaupun link dah tamat.')}
      ${hanyaSimpan?'':pil('📕',en?'PDF album':'Album PDF',en?'Photos & wishes as a PDF to keep or print.':'Gambar & ucapan dalam PDF untuk simpan atau cetak.')}
      <p style="font-size:.68rem;color:#8a6d7a;line-height:1.55;margin:12px 2px 0">${en
        ?'📱 To open the saved card: tap the file in Downloads and open it with <b>Chrome</b> (Android) or <b>Safari</b> (iPhone: Files → hold the file → Share → Safari). Send it on WhatsApp as a <b>Document</b>. Music needs internet.'
        :'📱 Nak buka kad yang disimpan: tekan fail dalam Download & buka guna <b>Chrome</b> (Android) atau <b>Safari</b> (iPhone: Files → tekan lama fail → Kongsi → Safari). Nak hantar, guna WhatsApp → <b>Dokumen</b>. Lagu perlukan internet.'}</p>
    </div>`;
    o.addEventListener('click',e=>{
      const b=e.target.closest('button'); if(e.target===o||(b&&b.dataset.k==='x')){o.remove();return;}
      if(!b) return;
      if(b.dataset.k==='💾') simpanKad(b);
      else if(b.dataset.k==='📕'){ o.remove(); build(); }
    });
    document.body.appendChild(o);
  }

  window.GKAlbum={
    init(data){
      D=data||{};
      makeBtn();   // semua kad — Basic & Premium
    },
    simpan:jadikanFail
  };

  /* 💾 Simpan Kad — PREMIUM SAHAJA. Semak pelan kad (lajur cards.plan)
     selepas halaman dimuatkan, kemudian tukar label butang album.
     Kad yang tak panggil GKAlbum.init (cth. Capit) → pasang butang sendiri
     kalau kad Premium yang sah (dibayar & belum tamat); panel tunjuk Simpan sahaja. */
  if(!OFFLINE) window.addEventListener('load',()=>setTimeout(async()=>{
    const id=new URLSearchParams(location.search).get('id');
    const cli=(typeof db!=='undefined'&&db)?db:null;
    if(!id||!cli) return;
    try{
      const r=await cli.from('cards').select('plan,paid,card_data->tamat').eq('id',id).single();
      const d=r&&r.data; if(!d||d.plan!=='premium') return;
      premium=true;
      if(document.getElementById('gk-album-btn')){ if(!busy) setBtn(LABEL(),false); }
      else if(d.paid===true&&!d.tamat){ hanyaSimpan=true; makeBtn(); }
    }catch(e){}
  },1500));
})();
