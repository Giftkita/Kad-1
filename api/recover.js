// ════════════════════════════════════════════════════════════
//  /api/recover.js — customer cari semula link kad mereka.
//  POST {email, phone} → {cards:[{id, created_at}]}
//  Bonus: kad yang bayarannya lambat disahkan akan di-verify
//  secara automatik di sini (self-healing).
// ════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    let { email, phone } = req.body || {};
    email = (email || '').trim().toLowerCase();
    phone = (phone || '').trim().replace(/\D/g, '');
    if (!email || !phone) { res.status(400).json({ error: 'Sila isi email & no. telefon.' }); return; }

    // cari kad ikut email (padankan telefon secara longgar: digit sahaja)
    const rows = await sbGet(
      `cards?buyer_email=ilike.${encodeURIComponent(email)}&select=id,paid,amount,ref_code,bill_code,buyer_phone,created_at&order=created_at.desc&limit=15`
    );
    const mine = rows.filter(r => ((r.buyer_phone || '').replace(/\D/g, '')) === phone);

    if (!mine.length) {
      res.status(200).json({ cards: [], error: 'Tiada kad dijumpai dengan email & telefon ini. Pastikan sama seperti semasa membeli.' });
      return;
    }

    // untuk kad belum paid tapi ada bill: cuba sahkan dengan ToyyibPay (self-heal)
    for (const c of mine) {
      if (c.paid !== true && c.bill_code) {
        const isPaid = await verifyPaid(c.bill_code);
        if (isPaid) {
          await sbPatch(`cards?id=eq.${c.id}`, { paid: true });
          c.paid = true;
          // rekod jualan + komisen (idempotent)
          const existing = await sbGet(`sales?bill_code=eq.${encodeURIComponent(c.bill_code)}&select=id`);
          if (!existing.length) {
            const sale = await sbInsert('sales', {
              card_id: c.id, ref_code: c.ref_code,
              amount: c.amount, bill_code: c.bill_code, status: 'paid'
            });
            const saleId = sale[0] && sale[0].id;
            if (c.ref_code) {
              const aff = await sbGet(`affiliates?code=eq.${encodeURIComponent(c.ref_code)}&active=eq.true&select=code,commission_flat`);
              if (aff.length) {
                const commission = Number(aff[0].commission_flat) || 2;
                await sbInsert('commissions', {
                  affiliate_code: c.ref_code, sale_id: saleId,
                  amount: commission, paid_out: false
                });
              }
            }
          }
        }
      }
    }

    // pulangkan hanya kad yang PAID
    const paidCards = mine.filter(c => c.paid === true).map(c => ({ id: c.id, created_at: c.created_at }));
    if (!paidCards.length) {
      res.status(200).json({ cards: [], error: 'Kad dijumpai tetapi bayaran belum disahkan. Jika baru bayar, tunggu beberapa minit & cuba lagi.' });
      return;
    }

    res.status(200).json({ cards: paidCards });

  } catch (e) {
    res.status(500).json({ error: e.message });
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
