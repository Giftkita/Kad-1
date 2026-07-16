// ════════════════════════════════════════════════════════════
//  /api/affiliate-register.js — daftar affiliate + bill RM10
//  POST {name, email, phone, code} → {paymentUrl}
// ════════════════════════════════════════════════════════════

const REG_FEE = 1000; // RM10 dalam SEN

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    let { name, email, phone, code } = req.body || {};
    name  = (name  || '').trim();
    email = (email || '').trim();
    phone = (phone || '').trim();
    code  = (code  || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!name || !email || !phone || !code) { res.status(400).json({ error: 'Sila isi semua maklumat.' }); return; }
    if (!/^[A-Z0-9]{3,12}$/.test(code)) { res.status(400).json({ error: 'Kod mesti 3-12 huruf/nombor sahaja.' }); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { res.status(400).json({ error: 'Email tidak sah.' }); return; }

    // semak kod
    const existing = await sbGet(`affiliates?code=eq.${encodeURIComponent(code)}&select=id,active,email`);
    if (existing.length && existing[0].active === true) {
      res.status(400).json({ error: 'Kod "' + code + '" telah diambil. Pilih kod lain.' }); return;
    }

    // cipta bill RM10
    const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
    const TPAY = (process.env.TOYYIBPAY_BASE || 'https://toyyibpay.com').replace(/\/$/, '');
    const form = new URLSearchParams({
      userSecretKey:   process.env.TOYYIBPAY_SECRET,
      categoryCode:    process.env.TOYYIBPAY_CATEGORY,
      billName:        'GiftKita Affiliate',
      billDescription: 'Yuran pendaftaran affiliate GiftKita (RM10)',
      billPriceSetting:'1',
      billPayorInfo:   '1',
      billAmount:      String(REG_FEE),
      billReturnUrl:   `${SITE}/affiliate.html?code=${code}`,
      billCallbackUrl: `${SITE}/api/callback`,
      billExternalReferenceNo: 'AFF-' + code,
      billTo:          name.slice(0, 30),
      billEmail:       email,
      billPhone:       phone,
      billPaymentChannel: '0'
    });

    const r = await fetch(`${TPAY}/index.php/api/createBill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const data = await r.json();
    const billCode = Array.isArray(data) && data[0] && data[0].BillCode;
    if (!billCode) { res.status(502).json({ error: 'Gagal cipta bil. Cuba lagi.', detail: data }); return; }

    // simpan / kemaskini rekod affiliate (belum aktif)
    const row = { code, name, email, whatsapp: phone, active: false, commission_flat: 2, bill_code: billCode };
    if (existing.length) {
      await sbPatch(`affiliates?code=eq.${encodeURIComponent(code)}`, row);
    } else {
      await sbInsert('affiliates', row);
    }

    res.status(200).json({ paymentUrl: `${TPAY}/${billCode}` });

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
async function sbInsert(table, row) {
  const { url, key } = SB();
  const r = await fetch(url + table, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return r.json();
}
