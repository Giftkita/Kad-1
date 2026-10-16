/* GiftKita — Meta Pixel (ID 2066633493982237) · Events Manager: dataset "GiftKita Pixel", ad account "GiftKita Ads"
   Dimuat AUTOMATIK oleh gk-pixel.js (jadi semua page yang ada TikTok Pixel — index, buat-kad*, bayar, semua borang via gk-bayar.js — dapat Meta Pixel sekali).
   Boleh juga dimuat terus:  <script src="gk-meta.js"></script>
   Event dihantar automatik melalui GKPixel.track (gk-pixel.js):
     PageView (setiap page) · ViewContent (borang dibuka) · InitiateCheckout (tekan bayar) · Purchase (bayar.html berjaya)
   Guna terus (pilihan):  GKMeta.track('Lead',{content_name:'Affiliate'}) */
(function(f,b,e,v,n,t,s){
  if(f.__gkMeta)return; f.__gkMeta=1;
  if(!f.fbq){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);}
  try{f.fbq('init','2066633493982237');f.fbq('track','PageView');}catch(x){}
})(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

window.GKMeta={
  /* Peta nama event TikTok → Meta (yang lain dihantar nama sama) */
  peta:{CompletePayment:'Purchase',ViewContent:'ViewContent',InitiateCheckout:'InitiateCheckout',AddToCart:'AddToCart',Lead:'Lead',Contact:'Contact'},
  /* Tukar format item TikTok ({contents:[{content_id,content_name,price}],value,currency}) → format Meta */
  ubah:function(d){
    try{
      if(!d)return {};
      var o={};
      for(var k in d){if(k!=='contents')o[k]=d[k];}
      if(d.contents&&d.contents.length){
        var c=d.contents[0];
        o.content_ids=d.contents.map(function(x){return String(x.content_id||x.content_name||'kad');});
        o.content_type='product';
        if(c.content_name)o.content_name=c.content_name;
        o.contents=d.contents.map(function(x){return {id:String(x.content_id||x.content_name||'kad'),quantity:1,item_price:x.price};});
        o.num_items=d.contents.length;
      }
      if(o.value!=null)o.value=Number(o.value)||0;
      if(!o.currency)o.currency='MYR';
      return o;
    }catch(e){return d||{};}
  },
  track:function(ev,data){
    try{
      var nama=this.peta[ev]||ev;
      var std={PageView:1,ViewContent:1,InitiateCheckout:1,Purchase:1,AddToCart:1,Lead:1,Contact:1,CompleteRegistration:1,Search:1,AddPaymentInfo:1};
      window.fbq&&window.fbq(std[nama]?'track':'trackCustom',nama,this.ubah(data));
    }catch(e){}
  }
};
/* Hantar event yang sempat dibaris oleh gk-pixel.js sebelum fail ni siap dimuat */
(function(){try{var q=window.__gkMetaQ||[];window.__gkMetaQ=null;for(var i=0;i<q.length;i++)GKMeta.track(q[i][0],q[i][1]);}catch(e){}})();
