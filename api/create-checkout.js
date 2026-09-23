// ════════════════════════════════════════════════════════════
//  /api/create-checkout.js — cipta halaman bayaran Stripe (USD)
//  Untuk customer LUAR NEGARA. Customer Malaysia masih guna
//  /api/create-bill.js (ToyyibPay, RM).
//
//  Dipanggil oleh gk-bayar.js bila mod USD. Aliran sama macam ToyyibPay:
//    borang simpan kad (paid:false) → sini cipta sesi Stripe → customer bayar
//    → Stripe hantar balik ke bayar.html?id=… → /api/verify sahkan → kad aktif
//
//  Env Vercel yang WAJIB: STRIPE_SECRET_KEY (sk_test_… untuk test, sk_live_… untuk jualan)
//  Env pilihan: USD_MYR (anggaran kadar, lalai 4.2 — hanya sandaran rekod jualan)
//  Tiada pakej npm diperlukan — guna fetch terus ke API Stripe.
// ════════════════════════════════════════════════════════════

// Harga dalam SEN USD ($8 = 800). Server yang tentukan harga, BUKAN client.
// Kunci pelan MESTI sama dengan create-bill.js.
const PRICES_USD = { basic: 800, premium: 1000, bouquet: 300 };
const PLAN_NAME  = { basic: 'GiftKita Basic', premium: 'GiftKita Premium', bouquet: 'GiftKita Photo Bouquet' };
const PLAN_DESC  = {
  basic:   'Personalized digital greeting card · YouTube music · permanent link',
  premium: 'Personalized digital greeting card · your own MP3 · QR code · PDF album',
  bouquet: 'Personalized photo bouquet image · full resolution, no watermark'
};

// Domain yang dibenarkan untuk URL "kembali ke borang" (elak open-redirect)
const HOS_SAH = /(^|\.)giftkita\.com$|(^|\.)giftkita\.github\.io$|\.vercel\.app$|^localhost$/;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  try {
    const KEY = process.env.STRIPE_SECRET_KEY;
    if (!KEY) { res.status(500).json({ error: 'Card payment is not set up yet. Please try again later.' }); return; }

    const { cardId, plan, buyerName, buyerEmail, returnUrl } = req.body || {};
    if (!cardId || !PRICES_USD[plan]) { res.status(400).json({ error: 'Incomplete data' }); return; }

    // kad mesti wujud & belum dibayar
    const cards = await sbGet(`cards?id=eq.${encodeURIComponent(cardId)}&select=id,paid`);
    if (!cards[0]) { res.status(404).json({ error: 'Card not found' }); return; }
    if (cards[0].paid === true) { res.status(400).json({ error: 'This card is already paid' }); return; }

    const SITE = (process.env.SITE_URL || 'https://www.giftkita.com').replace(/\/$/, '');
    const cents = PRICES_USD[plan];

    // URL batal → balik ke borang (dengan tanda supaya gk-bayar tak redirect ke bayar.html)
    let batal = SITE;
    try {
      const u = new URL(returnUrl);
      if (HOS_SAH.test(u.hostname)) { u.hash = ''; u.searchParams.set('gk_batal', '1'); batal = u.toString(); }
    } catch (e) {}

    const p = new URLSearchParams();
    p.set('mode', 'payment');
    p.set('success_url', `${SITE}/bayar.html?id=${encodeURIComponent(cardId)}`);
    p.set('cancel_url', batal);
    p.set('client_reference_id', cardId);
    p.set('locale', 'auto');
    p.set('line_items[0][quantity]', '1');
    p.set('line_items[0][price_data][currency]', 'usd');
    p.set('line_items[0][price_data][unit_amount]', String(cents));
    p.set('line_items[0][price_data][product_data][name]', PLAN_NAME[plan]);
    p.set('line_items[0][price_data][product_data][description]', PLAN_DESC[plan]);
    p.set('metadata[card_id]', cardId);
    p.set('metadata[plan]', plan);
    p.set('payment_intent_data[metadata][card_id]', cardId);
    p.set('payment_intent_data[metadata][plan]', plan);
    p.set('payment_intent_data[description]', `${PLAN_NAME[plan]} · ${cardId}`);
    if (buyerEmail && /^\S+@\S+\.\S+$/.test(buyerEmail)) p.set('customer_email', buyerEmail);
    if (buyerName) p.set('metadata[buyer_name]', String(buyerName).slice(0, 100));

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `gk-${cardId}-${plan}`
      },
      body: p.toString()
    });
    const s = await r.json();
    if (!s || !s.id || !s.url) {
      res.status(502).json({ error: (s && s.error && s.error.message) || 'Could not start payment' });
      return;
    }

    // simpan id sesi Stripe dalam bill_code (verify.js kenal awalan cs_)
    // amount = anggaran RM; nilai RM sebenar ditulis semula bila bayaran disahkan
    const kadar = Number(process.env.USD_MYR) || 4.2;
    await sbPatch(`cards?id=eq.${encodeURIComponent(cardId)}`, {
      bill_code: s.id, plan, amount: Math.round(cents / 100 * kadar * 100) / 100
    });

    res.status(200).json({ paymentUrl: s.url });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── helper Supabase REST (service key) ──
const SB = () => ({ url: process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/', key: process.env.SUPABASE_SERVICE_KEY });
async function sbGet(path) {
  const { url, key } = SB();
  const r = await fetch(url + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  return r.json();
}
async function sbPatch(path, bodyObj) {
  const { url, key } = SB();
  await fetch(url + path, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(bodyObj)
  });
}
