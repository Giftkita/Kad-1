// ════════════════════════════════════════════════════════════
//  /api/verify.js — semak terus ke ToyyibPay & tanda kad paid.
//  Dipanggil oleh bayar.html selepas customer kembali dari bayaran.
//  Lapisan kedua selain callback — mana-mana satu berjaya, kad aktif.
// ════════════════════════════════════════════════════════════

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
    const cards = await sbGet(`cards?id=eq.${cardId}&select=id,paid,amount,ref_code,bill_code`);
    const card = cards[0];
    if (!card) { res.status(200).json({ paid: false, error: 'card not found' }); return; }

    // dah paid? terus jawab ya
    if (card.paid === true) { res.status(200).json({ paid: true }); return; }
    if (!card.bill_code) { res.status(200).json({ paid: false, error: 'no bill yet' }); return; }

    // 2) tanya ToyyibPay: bill ni dah dibayar?
    const isPaid = await verifyPaid(card.bill_code);
    if (!isPaid) { res.status(200).json({ paid: false }); return; }

    // 3) tanda paid
    await sbPatch(`cards?id=eq.${cardId}`, { paid: true });

    // 4) rekod jualan (idempotent — skip kalau dah ada)
    const existing = await sbGet(`sales?bill_code=eq.${encodeURIComponent(card.bill_code)}&select=id`);
    if (!existing.length) {
      const sale = await sbInsert('sales', {
        card_id: cardId, ref_code: card.ref_code,
        amount: card.amount, bill_code: card.bill_code, status: 'paid'
      });
      const saleId = sale[0] && sale[0].id;

      // 5) komisen affiliate jika ada
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
    }

    res.status(200).json({ paid: true });

  } catch (e) {
    res.status(200).json({ paid: false, error: e.message });
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
