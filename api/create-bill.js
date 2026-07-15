// ════════════════════════════════════════════════════════════
//  /api/create-bill.js  — cipta bill ToyyibPay (server-side)
//  Dipanggil oleh builder bila customer tekan "Bayar".
// ════════════════════════════════════════════════════════════

// Harga dalam SEN (RM8 = 800, RM15 = 1500). Server yang tentukan harga,
// BUKAN client — supaya tak boleh diubah jadi RM0.
const PRICES    = { basic: 800,  premium: 1500 };
const PLAN_NAME = { basic: 'GiftKita Basic', premium: 'GiftKita Premium' };

module.exports = async (req, res) => {
  // CORS: benarkan panggilan dari GitHub Pages / domain lain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    const { cardId, plan, buyerName, buyerEmail, buyerPhone } = req.body || {};
    if (!cardId || !PRICES[plan]) { res.status(400).json({ error: 'Data tak lengkap' }); return; }

    const amountCents = PRICES[plan];
    const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
    const TPAY = (process.env.TOYYIBPAY_BASE || 'https://toyyibpay.com').replace(/\/$/, '');

    // 1) cipta bill ToyyibPay
    const form = new URLSearchParams({
      userSecretKey:   process.env.TOYYIBPAY_SECRET,
      categoryCode:    process.env.TOYYIBPAY_CATEGORY,
      billName:        PLAN_NAME[plan],                 // max 30 aksara
      billDescription: 'Kad ucapan digital GiftKita',
      billPriceSetting:'1',                             // 1 = harga tetap
      billPayorInfo:   '1',                             // prefill maklumat pembeli sebenar
      billAmount:      String(amountCents),             // dalam SEN
      billReturnUrl:   `${SITE}/bayar.html?id=${cardId}`,
      billCallbackUrl: `${SITE}/api/callback`,
      billExternalReferenceNo: cardId,
      billTo:          (buyerName  || 'Pelanggan').slice(0, 30),
      billEmail:       buyerEmail || 'noemail@giftkita.my',
      billPhone:       buyerPhone || '0000000000',
      billPaymentChannel: '0'
    });

    const r = await fetch(`${TPAY}/index.php/api/createBill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const data = await r.json();
    const billCode = Array.isArray(data) && data[0] && data[0].BillCode;
    if (!billCode) { res.status(502).json({ error: 'Gagal cipta bill', detail: data }); return; }

    // 2) simpan bill_code + amount ke card (service key, bypass RLS)
    await sbPatch(`cards?id=eq.${cardId}`, { bill_code: billCode, amount: amountCents / 100 });

    // 3) pulangkan URL bayaran
    res.status(200).json({ paymentUrl: `${TPAY}/${billCode}` });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── helper Supabase REST (service key) ──
async function sbPatch(path, body) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: KEY, Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  });
}
