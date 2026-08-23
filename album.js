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
  let D={}, busy=false;

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
    b.innerHTML='📕 Muat Turun Album';
    b.style.cssText=`position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 54px);
      z-index:400;background:linear-gradient(135deg,#e91e63,#a8121c);color:#fff;border:none;
      border-radius:40px;padding:11px 17px;font-family:Poppins,sans-serif;font-size:.72rem;
      font-weight:600;letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35)`;
    b.onclick=build;
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
      setTimeout(()=>setBtn('📕 Muat Turun Album',false),2600);
    }catch(e){
      console.error(e);
      setBtn('❌ Gagal — cuba lagi',false);
      setTimeout(()=>setBtn('📕 Muat Turun Album',false),3000);
    }
    busy=false;
  }

  window.GKAlbum={
    init(data){
      D=data||{};
      makeBtn();   // semua kad — Basic & Premium
    }
  };
})();
