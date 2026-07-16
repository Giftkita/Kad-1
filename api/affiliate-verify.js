// ════════════════════════════════════════════════════════════
//  /api/affiliate-verify.js — sahkan bayaran RM10 & pulangkan statistik
//  POST {code} → {active, stats:{clicks, sales, total, unpaid}}
// ════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    let { code } = req.body || {};
    code = (code || '').trim().toUpperCase();
    if (!code) { res.status(400).json({ active: false, error: 'no code' }); return; }

    const affs = await sbGet(`affiliates?code=eq.${encodeURIComponent(code)}&select=code,name,active,bill_code,commission_flat`);
    const aff = affs[0];
    if (!aff) { res.status(200).json({ active: false, error: 'Kod tidak dijumpai.' }); return; }

    // belum aktif? cuba sahkan bayaran RM10 dengan ToyyibPay
    if (aff.active !== true) {
      if (!aff.bill_code) { res.status(200).json({ active: false, error: 'Belum ada bayaran. Sila daftar dahulu.' }); return; }
      const isPaid = await verifyPaid(aff.bill_code);
      if (!isPaid) { res.status(200).json({ active: false }); return; }
      await sbPatch(`affiliates?code=eq.${encodeURIComponent(code)}`, { active: true });
      aff.active = true;
    }

    // statistik
    const clicks = await sbGet(`affiliate_clicks?code=eq.${encodeURIComponent(code)}&select=id`);
    const comms  = await sbGet(`commissions?affiliate_code=eq.${encodeURIComponent(code)}&select=amount,paid_out`);
    let total = 0, unpaid = 0;
    comms.forEach(c => {
      const a = Number(c.amount) || 0;
      total += a;
      if (!c.paid_out) unpaid += a;
    });

    res.status(200).json({
      active: true,
      name: aff.name || '',
      commission_flat: Number(aff.commission_flat) || 2,
      stats: {
        clicks: clicks.length,
        sales: comms.length,
        total: Math.round(total * 100) / 100,
        unpaid: Math.round(unpaid * 100) / 100
      }
    });

  } catch (e) {
    res.status(200).json({ active: false, error: e.message });
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
