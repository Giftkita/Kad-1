// ════════════════════════════════════════════════════════════
//  /api/stripe-webhook.js — Stripe panggil ini bila bayaran USD selesai.
//  Sama tugas dengan callback.js (ToyyibPay): tanda kad paid → rekod jualan
//  → kira komisen. Idempotent ikut id sesi Stripe (disimpan dalam bill_code).
//
//  KESELAMATAN: kita TAK percaya isi POST. Kita cuma ambil id sesi, kemudian
//  tanya Stripe sendiri (guna STRIPE_SECRET_KEY) sama ada sesi tu betul-betul
//  dibayar. Jadi tak perlu signing secret, dan POST palsu tak boleh aktifkan kad.
//
//  Daftar di Stripe → Developers → Webhooks → Add endpoint:
//    URL:    https://www.giftkita.com/api/stripe-webhook
//    Events: checkout.session.completed, checkout.session.async_payment_succeeded
// ════════════════════════════════════════════════════════════

// SAMA dengan callback.js & verify.js — produk tanpa komisen affiliate.
const TIADA_KOMISEN = { bouquet: true };

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  try {
    let ev = req.body;
    if (typeof ev === 'string') { try { ev = JSON.parse(ev); } catch (e) { ev = {}; } }
    const jenis = ev && ev.type;
    const obj = ev && ev.data && ev.data.object;
    if (!obj || !/^checkout\.session\./.test(jenis || '') || !/^cs_/.test(obj.id || '')) {
      res.status(200).send('ignored'); return;
    }

    const hasil = await selesaikanStripe(obj.id);
    res.status(200).send(hasil);

  } catch (e) {
    // 500 → Stripe akan cuba semula kemudian (verify.js juga akan tangkap bila customer kembali)
    res.status(500).send('err:' + e.message);
  }
};

// ── sahkan dengan Stripe & aktifkan kad (dikongsi logik dengan verify.js) ──
async function selesaikanStripe(sessionId) {
  const s = await sesiStripe(sessionId);
  if (!s || s.payment_status !== 'paid') return 'not paid';

  const cardId = s.client_reference_id || (s.metadata && s.metadata.card_id);
  if (!cardId) return 'no card id';

  const cards = await sbGet(`cards?id=eq.${encodeURIComponent(cardId)}&select=id,amount,ref_code,plan,bill_code`);
  const card = cards[0];
  if (!card) return 'no card';
  if (card.bill_code && card.bill_code !== sessionId) return 'session mismatch';

  const myr = rmSebenar(s);
  await sbPatch(`cards?id=eq.${encodeURIComponent(cardId)}`,
    myr ? { paid: true, amount: myr } : { paid: true });

  const existing = await sbGet(`sales?bill_code=eq.${encodeURIComponent(sessionId)}&select=id`);
  if (existing.length) return 'already processed';

  const sale = await sbInsert('sales', {
    card_id: cardId, ref_code: card.ref_code,
    amount: myr || card.amount, bill_code: sessionId, status: 'paid'
  });
  const saleId = sale[0] && sale[0].id;

  const plan = card.plan || (s.metadata && s.metadata.plan) || 'basic';
  if (card.ref_code && !TIADA_KOMISEN[plan]) {
    const aff = await sbGet(
      `affiliates?code=eq.${encodeURIComponent(card.ref_code)}&active=eq.true&select=code,commission_flat`
    );
    if (aff.length) {
      const commission = Number(aff[0].commission_flat) || 2;   // RM2 flat setiap jualan
      await sbInsert('commissions', {
        affiliate_code: card.ref_code, sale_id: saleId,
        amount: commission, paid_out: false
      });
    }
  }
  return 'OK';
}

// ambil sesi + nilai RM sebenar yang masuk akaun Stripe (balance_transaction)
async function sesiStripe(id) {
  const q = 'expand[]=payment_intent.latest_charge.balance_transaction';
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}?${q}`, {
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY }
  });
  return r.json();
}
function rmSebenar(s) {
  try {
    const bt = s.payment_intent.latest_charge.balance_transaction;
    if (bt && bt.currency === 'myr') return Math.round(bt.amount) / 100;   // jumlah kasar dalam RM
  } catch (e) {}
  return null;
}

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
async function sbInsert(table, row) {
  const { url, key } = SB();
  const r = await fetch(url + table, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return r.json();
}

module.exports.selesaikanStripe = selesaikanStripe;
