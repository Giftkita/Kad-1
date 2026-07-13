// ════════════════════════════════════════════════════════════
//  /api/callback.js  — ToyyibPay panggil ini bila bayaran selesai.
//  Tugas: sahkan bayaran → tanda kad 'paid' → rekod jualan → kira komisen.
//  Semua guna SERVICE KEY (bypass RLS). Idempotent (tak double-rekod).
// ════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  try {
    const body = req.body || {};
    const billcode = body.billcode || body.billCode;
    const cardId   = body.order_id || body.orderId;
    if (!billcode) { res.status(200).send('no billcode'); return; }

    // 1) sahkan bayaran SECARA AUTHORITATIF (jangan percaya POST mentah)
    const paid = await verifyPaid(billcode);
    if (!paid) { res.status(200).send('not paid'); return; }

    // 2) idempotent — kalau bill ni dah diproses, berhenti
    const existing = await sbGet(`sales?bill_code=eq.${encodeURIComponent(billcode)}&select=id`);
    if (existing.length) { res.status(200).send('already processed'); return; }

    // 3) ambil kad (amount, ref_code)
    const cards = await sbGet(`cards?id=eq.${cardId}&select=id,amount,ref_code`);
    const card = cards[0];
    if (!card) { res.status(200).send('no card'); return; }

    // 4) tanda kad 'paid'
    await sbPatch(`cards?id=eq.${cardId}`, { paid: true });

    // 5) rekod jualan
    const sale = await sbInsert('sales', {
      card_id: cardId, ref_code: card.ref_code,
      amount: card.amount, bill_code: billcode, status: 'paid'
    });
    const saleId = sale[0] && sale[0].id;

    // 6) kira komisen kalau ada kod affiliate yang sah
    if (card.ref_code) {
      const aff = await sbGet(
        `affiliates?code=eq.${encodeURIComponent(card.ref_code)}&active=eq.true&select=code,commission_rate`
      );
      if (aff.length) {
        const rate = Number(aff[0].commission_rate) || 0;
        const commission = Math.round(Number(card.amount) * rate * 100) / 100;
        await sbInsert('commissions', {
          affiliate_code: card.ref_code, sale_id: saleId,
          amount: commission, paid_out: false
        });
      }
    }

    res.status(200).send('OK');

  } catch (e) {
    // pulangkan 200 supaya ToyyibPay tak retry tanpa henti; ralat di-log Vercel
    res.status(200).send('err:' + e.message);
  }
};

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
  // billpaymentStatus: 1 = berjaya
  return Array.isArray(data) && data.some(t => String(t.billpaymentStatus) === '1');
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
