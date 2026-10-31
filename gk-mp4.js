/* ==========================================================================
   gk-mp4.js — GiftKita: jana video MP4 (H.264) TERUS dalam browser, tanpa server.
   GKMp4.rakam({ w, h, fps, saat, lukis:function(ctx,t,W,H){}, kemajuan:function(p){} })
     → Promise<{ blob, ext:'mp4'|'webm', w, h }>
   • Cara utama: WebCodecs VideoEncoder (Chrome/Android, Safari 16.4+) → MP4 dibina sendiri
     (muxer kecil di bawah, tiada library luar). Laju — tak perlu tunggu masa nyata.
   • Sandaran: MediaRecorder atas canvas (masa nyata; mp4 kalau browser sokong, kalau tak webm).
   • 1080×1920 dicuba dulu; kalau encoder tak sokong → 720×1280 (lukis() dapat W,H sebenar).
   ========================================================================== */
(function(){
  function u8(n){ return [n&255]; }
  function u16(n){ return [(n>>8)&255,n&255]; }
  function u32(n){ return [(n>>>24)&255,(n>>16)&255,(n>>8)&255,n&255]; }
  function str(s){ var a=[]; for(var i=0;i<s.length;i++) a.push(s.charCodeAt(i)&255); return a; }
  function gabung(list){ var n=0,i,p=0; for(i=0;i<list.length;i++) n+=list[i].length; var o=new Uint8Array(n); for(i=0;i<list.length;i++){ o.set(list[i],p); p+=list[i].length; } return o; }
  function box(type){ var parts=[].slice.call(arguments,1).map(function(x){ return x instanceof Uint8Array?x:new Uint8Array(x); }); var isi=gabung(parts); return gabung([new Uint8Array(u32(isi.length+8).concat(str(type))),isi]); }
  function vf(ver,flags){ return [ver,(flags>>16)&255,(flags>>8)&255,flags&255]; }
  var MATRIX=[].concat(u32(0x10000),u32(0),u32(0),u32(0),u32(0x10000),u32(0),u32(0),u32(0),u32(0x40000000));

  function binaMp4(sampel,desc,W,H,fps){
    var TS=90000, delta=Math.round(TS/fps), N=sampel.length, durTS=N*delta, durMs=Math.round(N*1000/fps);
    var saiz=[], kunci=[], jumlah=0;
    sampel.forEach(function(s,i){ saiz.push(s.data.length); jumlah+=s.data.length; if(s.key) kunci.push(i+1); });
    var ftyp=box('ftyp',str('isom'),u32(512),str('isomiso2avc1mp41'));
    function moov(off){
      var mvhd=box('mvhd',vf(0,0),u32(0),u32(0),u32(1000),u32(durMs),u32(0x10000),u16(0x100),new Array(10).fill(0),MATRIX,new Array(24).fill(0),u32(2));
      var tkhd=box('tkhd',vf(0,3),u32(0),u32(0),u32(1),u32(0),u32(durMs),new Array(8).fill(0),u16(0),u16(0),u16(0),u16(0),MATRIX,u32(W<<16),u32(H<<16));
      var mdhd=box('mdhd',vf(0,0),u32(0),u32(0),u32(TS),u32(durTS),u16(0x55c4),u16(0));
      var hdlr=box('hdlr',vf(0,0),u32(0),str('vide'),new Array(12).fill(0),str('VideoHandler'),[0]);
      var vmhd=box('vmhd',vf(0,1),u16(0),u16(0),u16(0),u16(0));
      var dinf=box('dinf',box('dref',vf(0,0),u32(1),box('url ',vf(0,1))));
      var avcC=box('avcC',desc);
      var nama=new Array(32).fill(0);
      var avc1=box('avc1',new Array(6).fill(0),u16(1),u16(0),u16(0),new Array(12).fill(0),u16(W),u16(H),u32(0x480000),u32(0x480000),u32(0),u16(1),nama,u16(0x18),u16(0xffff),avcC);
      var stsd=box('stsd',vf(0,0),u32(1),avc1);
      var stts=box('stts',vf(0,0),u32(1),u32(N),u32(delta));
      var stss=box('stss',vf(0,0),u32(kunci.length),[].concat.apply([],kunci.map(u32)));
      var stsc=box('stsc',vf(0,0),u32(1),u32(1),u32(N),u32(1));
      var stsz=box('stsz',vf(0,0),u32(0),u32(N),[].concat.apply([],saiz.map(u32)));
      var stco=box('stco',vf(0,0),u32(1),u32(off));
      var stbl=box('stbl',stsd,stts,stss,stsc,stsz,stco);
      var minf=box('minf',vmhd,dinf,stbl);
      var mdia=box('mdia',mdhd,hdlr,minf);
      var trak=box('trak',tkhd,mdia);
      return box('moov',mvhd,trak);
    }
    var m=moov(0), off=ftyp.length+m.length+8; m=moov(off);
    var kepala=new Uint8Array(u32(jumlah+8).concat(str('mdat')));
    return new Blob([ftyp,m,kepala].concat(sampel.map(function(s){ return s.data; })),{type:'video/mp4'});
  }

  async function cariConfig(W,H,fps){
    if(!window.VideoEncoder||!window.VideoFrame) return null;
    var kod=['avc1.640028','avc1.4d0028','avc1.42e028','avc1.640033','avc1.42001f'];
    var saiz=[[W,H],[Math.round(W*2/3/2)*2,Math.round(H*2/3/2)*2]];
    for(var s=0;s<saiz.length;s++) for(var k=0;k<kod.length;k++){
      var c={codec:kod[k],width:saiz[s][0],height:saiz[s][1],bitrate:saiz[s][0]>800?7000000:4000000,framerate:fps,avc:{format:'avc'},latencyMode:'quality'};
      try{ var r=await VideoEncoder.isConfigSupported(c); if(r&&r.supported) return c; }catch(e){}
    }
    return null;
  }

  async function webcodecs(o,cfg){
    var W=cfg.width,H=cfg.height,fps=o.fps, N=Math.round(o.saat*fps), sampel=[], desc=null, ralat=null;
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var ctx=cv.getContext('2d');
    var enc=new VideoEncoder({ output:function(ch,meta){ if(meta&&meta.decoderConfig&&meta.decoderConfig.description&&!desc) desc=new Uint8Array(meta.decoderConfig.description); var d=new Uint8Array(ch.byteLength); ch.copyTo(d); sampel.push({data:d,key:ch.type==='key',ts:ch.timestamp}); }, error:function(e){ ralat=e; } });
    enc.configure(cfg);
    for(var i=0;i<N;i++){
      if(ralat) throw ralat;
      ctx.setTransform(1,0,0,1,0,0); await o.lukis(ctx,i/fps,W,H);
      var fr=new VideoFrame(cv,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});
      enc.encode(fr,{keyFrame:i%(fps*2)===0}); fr.close();
      while(enc.encodeQueueSize>6) await new Promise(function(r){ setTimeout(r,8); });
      if(o.kemajuan&&i%5===0) o.kemajuan(i/N);
    }
    await enc.flush(); enc.close(); if(ralat) throw ralat;
    if(!desc) throw new Error('tiada avcC');
    sampel.sort(function(a,b){ return a.ts-b.ts; });
    if(o.kemajuan) o.kemajuan(1);
    return { blob:binaMp4(sampel,desc,W,H,fps), ext:'mp4', w:W, h:H };
  }

  function rakamMasaNyata(o){
    return new Promise(function(lulus,gagal){
      var W=o.w,H=o.h; var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var ctx=cv.getContext('2d');
      if(!cv.captureStream||!window.MediaRecorder) return gagal(new Error('tiada sokongan rakaman'));
      var jenis=['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm'].filter(function(m){ return MediaRecorder.isTypeSupported(m); })[0];
      var st=cv.captureStream(o.fps), rec=new MediaRecorder(st,{mimeType:jenis,videoBitsPerSecond:6000000}), bits=[];
      rec.ondataavailable=function(e){ if(e.data&&e.data.size) bits.push(e.data); };
      rec.onstop=function(){ var mp4=/mp4/.test(jenis); lulus({blob:new Blob(bits,{type:mp4?'video/mp4':'video/webm'}),ext:mp4?'mp4':'webm',w:W,h:H}); };
      var t0=null; rec.start(500);
      (function langkah(now){ if(t0===null) t0=now; var t=(now-t0)/1000; ctx.setTransform(1,0,0,1,0,0); o.lukis(ctx,Math.min(t,o.saat),W,H); if(o.kemajuan) o.kemajuan(Math.min(1,t/o.saat));
        if(t<o.saat) requestAnimationFrame(langkah); else setTimeout(function(){ rec.stop(); },200); })(performance.now());
      requestAnimationFrame(function(n){});
    });
  }

  window.GKMp4={ _bina:binaMp4,
    rakam: async function(o){
      o.w=o.w||1080; o.h=o.h||1920; o.fps=o.fps||30;
      var cfg=await cariConfig(o.w,o.h,o.fps);
      if(cfg){ try{ return await webcodecs(o,cfg); }catch(e){ console.warn('WebCodecs gagal, guna sandaran',e); } }
      return rakamMasaNyata(o);
    },
    simpan: function(r,nama){
      var u=URL.createObjectURL(r.blob), a=document.createElement('a'); a.href=u; a.download=(nama||'video-giftkita')+'.'+r.ext; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); },4000); return u; }
  };
})();
