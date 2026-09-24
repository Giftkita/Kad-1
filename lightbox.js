/* ══════════════════════════════════════════════════════════
   GiftKita — Lightbox gambar
   Tekan mana-mana gambar dalam kad → buka besar, boleh zoom & swipe
   Auto-pasang; tiada persediaan diperlukan.
   ══════════════════════════════════════════════════════════ */
(function(){
  var box,imgEl,capEl,list=[],idx=0;
  var scale=1,tx=0,ty=0,startD=0,startS=1,px=0,py=0,sx=0,sy=0,moved=false,pinching=false;

  function build(){
    box=document.createElement('div');
    box.id='gk-lb';
    box.style.cssText='position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.94);'+
      'display:none;align-items:center;justify-content:center;overflow:hidden;'+
      'touch-action:none;-webkit-user-select:none;user-select:none';

    imgEl=document.createElement('img');
    imgEl.style.cssText='max-width:100%;max-height:100%;display:block;'+
      'transform-origin:center center;will-change:transform;pointer-events:none';
    box.appendChild(imgEl);

    var close=document.createElement('button');
    close.innerHTML='&#10005;';
    close.setAttribute('aria-label','Tutup');
    close.style.cssText='position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);right:14px;'+
      'width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.28);'+
      'background:rgba(255,255,255,.14);color:#fff;font-size:16px;cursor:pointer;'+
      'backdrop-filter:blur(6px);z-index:2';
    close.onclick=function(e){e.stopPropagation();hide();};
    box.appendChild(close);

    capEl=document.createElement('div');
    capEl.style.cssText='position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);'+
      'left:0;right:0;text-align:center;color:rgba(255,255,255,.75);'+
      'font-family:Poppins,system-ui,sans-serif;font-size:.72rem;letter-spacing:.06em;pointer-events:none';
    box.appendChild(capEl);

    mkNav('&#8249;',14,function(){go(-1);});
    mkNav('&#8250;',null,function(){go(1);});

    box.addEventListener('click',function(e){ if(e.target===box) hide(); });
    bindGestures();
    document.body.appendChild(box);
  }

  function mkNav(sym,left,fn){
    var b=document.createElement('button');
    b.innerHTML=sym; b.className='gk-lb-nav';
    b.style.cssText='position:absolute;top:50%;transform:translateY(-50%);'+
      (left!==null?('left:'+left+'px;'):'right:14px;')+
      'width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.28);'+
      'background:rgba(255,255,255,.14);color:#fff;font-size:20px;line-height:1;cursor:pointer;'+
      'backdrop-filter:blur(6px);z-index:2;display:none';
    b.onclick=function(e){e.stopPropagation();fn();};
    box.appendChild(b);
  }

  function apply(){ imgEl.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')'; }
  function reset(){ scale=1;tx=0;ty=0;apply(); }

  function show(i){
    idx=i; imgEl.src=list[idx]; reset();
    capEl.textContent = list.length>1 ? (idx+1)+' / '+list.length : '';
    var navs=box.querySelectorAll('.gk-lb-nav');
    for(var k=0;k<navs.length;k++) navs[k].style.display = list.length>1 ? 'block' : 'none';
    box.style.display='flex';
    document.documentElement.style.overflow='hidden';
  }
  function hide(){ box.style.display='none'; document.documentElement.style.overflow=''; }
  function go(d){ if(list.length<2)return; idx=(idx+d+list.length)%list.length; show(idx); }

  function dist(t){ var a=t[0],b=t[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); }

  function bindGestures(){
    box.addEventListener('touchstart',function(e){
      if(e.touches.length===2){ pinching=true;startD=dist(e.touches);startS=scale; }
      else if(e.touches.length===1){
        moved=false;pinching=false;
        sx=e.touches[0].clientX; sy=e.touches[0].clientY; px=tx; py=ty;
      }
    },{passive:true});

    box.addEventListener('touchmove',function(e){
      if(pinching && e.touches.length===2){
        e.preventDefault();
        scale=Math.min(5,Math.max(1,startS*(dist(e.touches)/startD)));
        if(scale===1){tx=0;ty=0;}
        apply();
      }else if(e.touches.length===1 && scale>1){
        e.preventDefault();
        tx=px+(e.touches[0].clientX-sx); ty=py+(e.touches[0].clientY-sy); moved=true; apply();
      }else if(e.touches.length===1){
        if(Math.abs(e.touches[0].clientX-sx)>8) moved=true;
      }
    },{passive:false});

    box.addEventListener('touchend',function(e){
      if(pinching){ pinching=false; return; }
      if(scale>1) return;
      var dx=(e.changedTouches[0].clientX-sx);
      if(moved && Math.abs(dx)>60){ go(dx<0?1:-1); }
    },{passive:true});

    // ketuk dua kali untuk zoom
    var last=0;
    box.addEventListener('click',function(){
      var now=Date.now();
      if(now-last<300){ scale = scale>1?1:2.4; tx=0;ty=0; apply(); }
      last=now;
    });

    document.addEventListener('keydown',function(e){
      if(box.style.display==='none')return;
      if(e.key==='Escape')hide();
      if(e.key==='ArrowRight')go(1);
      if(e.key==='ArrowLeft')go(-1);
    });
  }

  /* kumpul semua gambar kad & jadikan boleh ditekan */
  function attach(){
    if(!box) build();
    var imgs=document.querySelectorAll('img');
    list=[];
    for(var i=0;i<imgs.length;i++){
      var im=imgs[i];
      if(im.closest('#gk-lb')) continue;
      if(im.dataset.gklb) { if(im.src) list.push(im.src); continue; }
      if(!im.src || im.src.indexOf('data:image/webp')===0) continue;  // langkau grafik hiasan
      if(im.naturalWidth && im.naturalWidth<60) continue;
      im.dataset.gklb='1';
      im.style.cursor='zoom-in';
      list.push(im.src);
      (function(src){
        im.addEventListener('click',function(ev){
          ev.stopPropagation();
          var k=list.indexOf(src);
          show(k<0?0:k);
        });
      })(im.src);
    }
  }

  window.GKLightbox={ attach:attach, open:show };

  // pasang selepas kad siap dipaparkan, dan bila gambar baru muncul
  function boot(){
    attach();
    var mo=new MutationObserver(function(){ clearTimeout(window._gklbT);
      window._gklbT=setTimeout(attach,250); });
    mo.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,600);});
  else setTimeout(boot,600);
})();
