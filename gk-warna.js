/* ====================================================================
   GiftKita — ENJIN WARNA KONGSI (gk-warna.js)
   Dipakai oleh kad kahwin (pelamin, impian, songket) & Album Baby (bayi).
   - Viewer: fail ini DISISIPKAN (inline) ke dalam card-*.html masa bina (supaya fail 💾 Album Baby kekal luar talian).
   - Borang: tag script src="gk-warna.js" → GKWarna.borang('gkWarna', SET, {...}) & GKWarna.nilai().
   Data kad: card_data.warna = kunci palet, card_data.warnaTeks = '#rrggbb' (pilihan, warna tulisan sendiri).

   Warna semula gambar: piksel yang hue-nya dalam julat SUMBER (cth biru 180–250°, merah 335–15°) dipusing ke hue
   palet, tepu & terang didarab (s,v). Kawasan "jaga" (cth langit) & piksel terlalu tepu dilangkau supaya kekal asli.
   ==================================================================== */
(function(G){
  function hexRgb(h){ h=String(h||'').replace('#',''); if(!/^[0-9a-f]{6}$/i.test(h)) return null; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  function campur(a,b,k){ return '#'+a.map(function(x,i){ return ('0'+Math.round(x+(b[i]-x)*k).toString(16)).slice(-2); }).join(''); }
  function kanvas(w,h){ var c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
  function dalamJulat(h,a,b){ return a<=b?(h>=a&&h<=b):(h>=a||h<=b); }
  function jarakHue(h,c){ var d=Math.abs(h-c)%360; return d>180?360-d:d; }

  /* pilih palet: SET = { kunci:{h,s,v, mr,mr2,g,kc,pn:[r,g,b], ...} }, d = card_data */
  function pilih(SET,d,asal){ var k=d&&d.warna&&SET[d.warna]?d.warna:asal, P=Object.assign({kunci:k},SET[k]), t=hexRgb(d&&d.warnaTeks);
    if(t){ var w=[255,255,255]; P.mr='#'+d.warnaTeks.replace('#','').toLowerCase(); P.g=campur(t,w,.22); P.kc=campur(t,w,.45); P.mr2=campur(t,w,.35); P.teksSendiri=true; }
    return P; }
  /* set pemboleh ubah CSS: peta = { '--mr':'mr', '--emas':'mr2', ... } */
  function css(P,peta){ var R=document.documentElement.style; for(var v in peta){ var x=P[peta[v]]; if(x!=null) R.setProperty(v,x); } }

  /* warna semula satu imej → kanvas. o = {sumber:[hMin,hMax], pusat:h, sMin, sMax, vMin, jaga:[[x0,y0,x1,y1,sHad],...]} ; P = palet {h,s,v} */
  function warnakan(im,P,o){ o=o||{}; var c=kanvas(im.naturalWidth||im.width,im.naturalHeight||im.height), x=c.getContext('2d'); x.drawImage(im,0,0);
    var D=x.getImageData(0,0,c.width,c.height), d=D.data, CW=c.width, CH=c.height, S=o.sumber||[180,250], pusat=o.pusat!=null?o.pusat:(S[0]<=S[1]?(S[0]+S[1])/2:((S[0]+S[1]+360)/2)%360),
      lebar=(S[0]<=S[1]?S[1]-S[0]:S[1]+360-S[0])/2, lembut=o.lembut||15, sMin=o.sMin||.035, sMax=o.sMax||.6, sLembut=o.sLembut||.2, vMin=o.vMin||0,
      J=(o.jaga||[]).map(function(j){ return [j[0]*CW,j[1]*CH,j[2]*CW,j[3]*CH,j[4]==null?0:j[4]]; }), tH=P.h, tS=P.s==null?1:P.s, tV=P.v==null?1:P.v, putar=o.putar==null?.6:o.putar;
    for(var i=0;i<d.length;i+=4){ if(d[i+3]===0) continue; var r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), dl=mx-mn; if(dl<sMin*mx||mx<vMin) continue;
      var s=dl/mx; if(s>sMax) continue;
      var h=mx===b?60*((r-g)/dl)+240:mx===g?60*((b-r)/dl)+120:60*(((g-b)/dl)%6); if(h<0) h+=360;
      var jh=jarakHue(h,pusat); if(jh>lebar) continue;
      if(J.length){ var px=(i>>2)%CW, py=(i>>2)/CW|0, lompat=false; for(var q=0;q<J.length;q++){ var j=J[q]; if(px>j[0]&&px<j[2]&&py>j[1]&&py<j[3]&&s>j[4]){ lompat=true; break; } } if(lompat) continue; }
      var wh=jh<lebar-lembut?1:(lebar-jh)/lembut, ws=s<sMax-sLembut?1:(sMax-s)/sLembut, w=wh*ws; if(w<=0) continue;
      var dh=((h-pusat+540)%360)-180, nh=(tH+dh*putar+360)%360, ns=Math.min(1,s*tS), nv=Math.min(1,mx*tV), C=nv*ns, X=C*(1-Math.abs((nh/60)%2-1)), m=nv-C, rr,gg,bb, k=Math.floor(nh/60)%6;
      if(k===0){rr=C;gg=X;bb=0}else if(k===1){rr=X;gg=C;bb=0}else if(k===2){rr=0;gg=C;bb=X}else if(k===3){rr=0;gg=X;bb=C}else if(k===4){rr=X;gg=0;bb=C}else{rr=C;gg=0;bb=X}
      d[i]=Math.round((r+(rr+m-r)*w)*255); d[i+1]=Math.round((g+(gg+m-g)*w)*255); d[i+2]=Math.round((b+(bb+m-b)*w)*255); }
    x.putImageData(D,0,0); return c; }
  /* warnakan senarai sasaran: [{obj, key, mime, o}] → ganti obj[key] dengan dataURL baru */
  function sedia(senarai,P,cb){ if(P.h==null){ cb&&cb(); return Promise.resolve(); }
    return Promise.all(senarai.map(function(z){ return new Promise(function(ok){ if(!z.obj||!z.obj[z.key]) return ok(); var im=new Image();
      im.onload=function(){ try{ var o=Object.assign({},z.o||{}); if(P.adj&&z.adj&&P.adj[z.adj]) Object.assign(o,P.adj[z.adj]); z.obj[z.key]=warnakan(im,o.P?o.P:P,o).toDataURL(z.mime||'image/png',.9); }catch(e){} ok(); };
      im.onerror=ok; im.src=z.obj[z.key]; }); })).then(function(){ cb&&cb(); }); }

  /* ---------- BORANG: pemilih palet + warna tulisan sendiri ---------- */
  var gaya=false;
  function borang(elId,SET,opt){ opt=opt||{}; var el=document.getElementById(elId); if(!el) return;
    if(!gaya){ gaya=true; var st=document.createElement('style'); st.textContent=
      '.gkw-pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:8px;margin-top:6px}'+
      '.gkw-pal label{cursor:pointer;text-align:center;font:600 11px/1.25 Poppins,sans-serif;color:#4a5568}.gkw-pal input{display:none}'+
      '.gkw-pal i{display:block;aspect-ratio:1;border-radius:50%;margin:0 auto 5px;width:100%;max-width:54px;border:3px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.12)}'+
      '.gkw-pal label:has(input:checked) i{box-shadow:0 0 0 3px var(--gk-accent,#333)}.gkw-pal label:has(input:checked){color:var(--gk-accent,#333)}'+
      '.gkw-teks{display:flex;align-items:center;gap:10px;margin-top:12px;font:500 13px Poppins,sans-serif}'+
      '.gkw-teks input[type=color]{width:44px;height:34px;border:0;background:none;padding:0;cursor:pointer}.gkw-teks input[type=color]:disabled{opacity:.35}';
      document.head.appendChild(st); }
    var lama=el.querySelector('input[name=gkwarna]')?nilai():null;
    var bm=(opt.lang||'ms')==='ms', h='<div class="gkw-pal">';
    Object.keys(SET).forEach(function(k,i){ var P=SET[k], nm=bm?P.nama:(P.namaEn||P.nama);
      h+='<label><input type="radio" name="gkwarna" value="'+k+'"'+(k===(opt.asal||Object.keys(SET)[0])?' checked':'')+'><i style="background:linear-gradient(135deg,'+(P.c1||'#fff')+' 0 35%,'+P.c2+' 35% 70%,'+P.mr+' 70%)"></i><span>'+nm+'</span></label>'; });
    h+='</div><label class="gkw-teks"><input type="checkbox" id="gkwSendiri"> <span>'+(bm?'Warna tulisan sendiri':'Custom text colour')+'</span> <input type="color" id="gkwTeks" value="'+(SET[opt.asal||Object.keys(SET)[0]].mr)+'" disabled></label>';
    el.innerHTML=h; G.GKWarna._SET=SET; document.getElementById('gkwSendiri').onchange=function(){ document.getElementById('gkwTeks').disabled=!this.checked; };
    el.querySelectorAll('input[name=gkwarna]').forEach(function(x){ x.addEventListener('change',function(){ el.querySelectorAll('input[name=gkwarna]').forEach(function(y){ y.dataset.sentuh=1; }); if(!document.getElementById('gkwSendiri').checked) document.getElementById('gkwTeks').value=SET[x.value].mr; if(opt.ubah) opt.ubah(x.value); }); });
    var q=lama&&lama.warna||new URLSearchParams(location.search).get('warna'); if(q&&SET[q]){ var r=el.querySelector('input[value="'+q+'"]'); if(r) r.checked=true; }
    if(lama&&lama.warnaTeks){ document.getElementById('gkwSendiri').checked=true; var c=document.getElementById('gkwTeks'); c.disabled=false; c.value=lama.warnaTeks; }
    else if(q&&SET[q]) document.getElementById('gkwTeks').value=SET[q].mr; }
  /* pilih palet dari kod (cth bila jantina bertukar) — hanya jika pengguna belum pilih sendiri */
  function setPalet(k){ var r=document.querySelector('input[name=gkwarna][value="'+k+'"]'); if(r&&!r.dataset.sentuh){ r.checked=true; if(!document.getElementById('gkwSendiri').checked&&window.GKWarna._SET) document.getElementById('gkwTeks').value=window.GKWarna._SET[k].mr; } }
  function nilai(){ var o={}, r=document.querySelector('input[name=gkwarna]:checked'); if(r) o.warna=r.value; var c=document.getElementById('gkwSendiri'); if(c&&c.checked) o.warnaTeks=document.getElementById('gkwTeks').value; return o; }

  /* ---------- SET PALET setiap template (nama, warna swatch c2, CSS mr/mr2/g/kc/tk, pusingan gambar h/s/v) ---------- */
  var SET={
    songket:{ /* sumber: biru muda */
      biru: {nama:'Biru Muda',namaEn:'Baby Blue',c2:'#a9cce3',h:null,mr:'#2f5d8a',mr2:'#6e9cc4',g:'#4f7fae',kc:'#7fa3c6',pn:[178,203,243]},
      pink: {nama:'Pink Dusty',namaEn:'Dusty Pink',c2:'#ecbccc',h:340,s:.85,v:1,mr:'#8a3d5a',mr2:'#d48aa6',g:'#b8607f',kc:'#cf93aa',pn:[240,196,210]},
      lilac:{nama:'Lilac',namaEn:'Lilac',c2:'#cdbdea',h:272,s:.85,v:1,mr:'#5b4785',mr2:'#a48bd0',g:'#7d64ad',kc:'#ad9bd2',pn:[214,200,240]},
      sage: {nama:'Sage',namaEn:'Sage',c2:'#bfd2ba',h:100,s:.55,v:.97,mr:'#4a6447',mr2:'#8fa98a',g:'#62805d',kc:'#98b093',pn:[200,218,196]},
      emas: {nama:'Champagne',namaEn:'Champagne',c2:'#e3cf9f',h:40,s:.7,v:.98,mr:'#7a5a22',mr2:'#c9a45c',g:'#a07a35',kc:'#c8ac74',pn:[236,220,186]}
    },
    pelamin:{ /* sumber: merah maroon (langsir & bunga ros) */
      maroon:{nama:'Maroon',namaEn:'Maroon',c2:'#c9505f',h:null,mr:'#7a1f2c',mr2:'#9a2a3a',g:'#7a1f2c',kc:'#6b3a3a',tk:'#4a1a22'},
      navy:  {nama:'Navy',namaEn:'Navy',c2:'#5d7fbf',h:222,s:.9,v:1.05,mr:'#1f3a6e',mr2:'#2f4f8a',g:'#1f3a6e',kc:'#3a4a6b',tk:'#1a2440'},
      emerald:{nama:'Emerald',namaEn:'Emerald',c2:'#4f9a7a',h:155,s:.8,v:.95,mr:'#1f5e46',mr2:'#2c7a5c',g:'#1f5e46',kc:'#3a5a4a',tk:'#16362a'},
      pink:  {nama:'Pink Dusty',namaEn:'Dusty Pink',c2:'#e7a9bd',h:342,s:.5,v:1.28,mr:'#a24a6a',mr2:'#c06a88',g:'#a24a6a',kc:'#8a5a6a',tk:'#5a2a3a'},
      ungu:  {nama:'Ungu',namaEn:'Purple',c2:'#a77cc2',h:285,s:.75,v:1.08,mr:'#5e2f7a',mr2:'#7a4596',g:'#5e2f7a',kc:'#5a4a6b',tk:'#33204a'},
      emas:  {nama:'Champagne',namaEn:'Champagne',c2:'#d9c08a',h:38,s:.4,v:2,mr:'#8a6a2a',mr2:'#a8843c',g:'#8a6a2a',kc:'#7a6440',tk:'#4a3a1a'}
    },
    impian:{ /* sumber: biru hydrangea & navy */
      biru: {nama:'Navy & Biru',namaEn:'Navy & Blue',c2:'#8fb0e3',h:null,mr:'#1f3a7a',mr2:'#3b5ba5',g:'#e8a6bf',kc:'#dfe6f7',bg:'#0e1f5b',aks:'#d987a6',pn:[178,203,243]},
      pink: {nama:'Pink',namaEn:'Pink',c2:'#f0b2c6',h:335,s:.72,v:1.05,mr:'#7a2f52',mr2:'#a24a72',g:'#f3c9a8',kc:'#f6e3ea',bg:'#5a1f3c',aks:'#c98a5a',pn:[243,196,214]},
      lilac:{nama:'Lilac',namaEn:'Lilac',c2:'#c5b2ea',h:272,s:.8,v:1.05,mr:'#4b2f7a',mr2:'#6a4aa0',g:'#f0b8d0',kc:'#ece4f8',bg:'#33205a',aks:'#d987a6',pn:[214,200,240]},
      sage: {nama:'Sage',namaEn:'Sage',c2:'#b9cfb4',h:110,s:.5,v:1,mr:'#3f5a40',mr2:'#5e7d5c',g:'#f3d9a8',kc:'#e6efe3',bg:'#2c4430',aks:'#c9a45c',pn:[200,218,196]},
      emas: {nama:'Champagne',namaEn:'Champagne',c2:'#e8d4a6',h:36,s:.6,v:1.08,mr:'#7a5428',mr2:'#a07a45',g:'#f6dcc0',kc:'#f5ecd8',bg:'#5a3e1c',aks:'#c47a97',pn:[236,220,186]}
    },
    bayi:{ /* tema pastel — kulit pink diwarna semula (biru = kulit biru asal) */
      pink: {nama:'Pink',namaEn:'Pink',c2:'#f4b6c2',h:null,u:'#f4b6c2',u2:'#e07f97',u3:'#fde8ec',t:'#6b4a55',mr:'#e07f97'},
      biru: {nama:'Biru',namaEn:'Blue',c2:'#a9cdee',h:null,u:'#a9cdee',u2:'#5f97cc',u3:'#e6f1fb',t:'#34495e',mr:'#5f97cc'},
      lilac:{nama:'Lilac',namaEn:'Lilac',c2:'#cdbdea',h:268,s:.9,v:1,u:'#cdbdea',u2:'#8f74c4',u3:'#f1ecfa',t:'#4e3f6b',mr:'#8f74c4'},
      mint: {nama:'Mint',namaEn:'Mint',c2:'#b5e0cf',h:155,s:.75,v:.98,u:'#b5e0cf',u2:'#5fae8f',u3:'#e8f6f0',t:'#35574a',mr:'#5fae8f'},
      kuning:{nama:'Kuning Peach',namaEn:'Peach',c2:'#f7d4a8',h:30,s:1.2,v:.97,u:'#f7d4a8',u2:'#e0a15f',u3:'#fdf1e2',t:'#6b5338',mr:'#e0a15f'}
    }
  };
  G.GKWarna={SET:SET,pilih:pilih,css:css,warnakan:warnakan,sedia:sedia,borang:borang,nilai:nilai,setPalet:setPalet,hexRgb:hexRgb,campur:campur};
})(window);
