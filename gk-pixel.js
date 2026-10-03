/* GiftKita — TikTok Pixel (ID DB0I4FBC77UA626ECV4G)
   Dimuat oleh: index.html, picker (buat-kad*.html), bayar.html, dan automatik oleh gk-bayar.js (semua borang).
   Guna: GKPixel.track('ViewContent',{content_name:'Flight to You'});  GKPixel.track('CompletePayment',{value:8,currency:'USD'}) */
(function(w,d,t){
  if(w.ttq&&w.ttq.load&&w.__gkPixel)return; w.__gkPixel=1;
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('DB0I4FBC77UA626ECV4G');
  ttq.page();
})(window,document,'ttq');
window.GKPixel={
  track:function(ev,data){try{window.ttq&&window.ttq.track(ev,data||{});}catch(e){}},
  /* produk kad: content_type 'product', content_id = template, value & currency */
  item:function(nama,id,harga,cur){return {contents:[{content_id:String(id||nama),content_type:'product',content_name:nama,price:harga}],value:harga,currency:cur||'MYR'};}
};
