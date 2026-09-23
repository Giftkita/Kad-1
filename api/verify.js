// ════════════════════════════════════════════════════════════
//  /api/verify.js — semak terus ke ToyyibPay & tanda kad paid.
//  Dipanggil oleh bayar.html selepas customer kembali dari bayaran.
//  Sokong DUA gateway: ToyyibPay (RM) dan Stripe (USD, bill_code 'cs_…').
//  Lapisan kedua selain callback — mana-mana satu berjaya, kad aktif.
// ════════════════════════════════════════════════════════════

// SAMA dengan callback.js — produk yang tidak bagi komisen affiliate.
// verify.js dan callback.js berlumba; mana-mana yang menang rekod jualan, jadi
// kedua-duanya MESTI ada senarai ini, kalau tak komisen bocor melalui satu laluan.
const TIADA_KOMISEN = { bouquet: true };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    const { cardId } = req.body || {};
    if (!cardId) { res.status(400).json({ paid: false, error: 'no cardId' }); return; }

    // 1) ambil kad
    //    'plan' kini lajur sebenar (ditulis oleh create-bill.js).
    //    card_data->>plan dibaca sebagai sandaran untuk kad lama.
    const cards = await sbGet(
      `cards?id=eq.${cardId}&select=id,paid,amount,ref_code,bill_code,plan,plan_lama:card_data->>plan`
    );
    const card = cards[0];
    if (!card) { res.status(200).json({ paid: false, error: 'card not found' }); return; }

    // dah paid? terus jawab ya
    if (card.paid === true) { res.status(200).json({ paid: true, plan: pakej(card) }); return; }
    if (!card.bill_code) { res.status(200).json({ paid: false, error: 'no bill yet' }); return; }

    // 2) bayaran USD (Stripe) — bill_code ialah id sesi 'cs_…'
    let myr = null;
    if (/^cs_/.test(card.bill_code)) {
      const s = await sesiStripe(card.bill_code);
      if (!s || s.payment_status !== 'paid') { res.status(200).json({ paid: false }); return; }
      myr = rmSebenar(s);
    } else {
      // 2b) bayaran RM — tanya ToyyibPay: bill ni dah dibayar?
      const isPaid = await verifyPaid(card.bill_code);
      if (!isPaid) { res.status(200).json({ paid: false }); return; }
    }

    // 3) tanda paid (USD: tulis juga nilai RM sebenar yang diterima)
    await sbPatch(`cards?id=eq.${cardId}`, myr ? { paid: true, amount: myr } : { paid: true });

    // 4) rekod jualan (idempotent — skip kalau dah ada)
    const existing = await sbGet(`sales?bill_code=eq.${encodeURIComponent(card.bill_code)}&select=id`);
    if (!existing.length) {
      const sale = await sbInsert('sales', {
        card_id: cardId, ref_code: card.ref_code,
        amount: myr || card.amount, bill_code: card.bill_code, status: 'paid'
      });
      const saleId = sale[0] && sale[0].id;

      // 5) komisen affiliate jika ada — dan produk ni layak komisen
      if (card.ref_code && !TIADA_KOMISEN[pakej(card)]) {
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
    }

    res.status(200).json({ paid: true, plan: pakej(card) });

  } catch (e) {
    res.status(200).json({ paid: false, error: e.message });
  }
};

// ── tentukan pakej: lajur 'plan' dahulu, card_data sebagai sandaran ──
function pakej(card) {
  return card.plan || card.plan_lama || 'basic';
}

// ── sahkan status bayaran via ToyyibPay ──
async function verifyPaid(billCode) {
  const TPAY = (process.env.TOYYIBPAY_BASE || 'https://toyyibpay.com').replace(/\/$/, '');
  const form = new URLSearchParams({ userSecretKey: process.env.TOYYIBPAY_SECRET, billCode });
  const r = await fetch(`${TPAY}/index.php/api/getBillTransactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  const data = await r.json();
  return Array.isArray(data) && data.some(t => String(t.billpaymentStatus) === '1');
}

// ── Stripe: ambil sesi + nilai RM sebenar (sama seperti stripe-webhook.js) ──
async function sesiStripe(id) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const q = 'expand[]=payment_intent.latest_charge.balance_transaction';
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}?${q}`, {
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY }
  });
  return r.json();
}
function rmSebenar(s) {
  try {
    const bt = s.payment_intent.latest_charge.balance_transaction;
    if (bt && bt.currency === 'myr') return Math.round(bt.amount) / 100;
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
