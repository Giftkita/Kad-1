// ════════════════════════════════════════════════════════════
//  /api/admin.js — panel admin (dilindungi ADMIN_TOKEN)
//  POST {token, action:'list'}                → tuntutan + ringkasan
//  POST {token, action:'mark_paid', id}      → tanda tuntutan dibayar
// ════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    const { token, action, id } = req.body || {};
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      res.status(401).json({ error: 'Token salah.' }); return;
    }

    if (action === 'mark_paid') {
      if (!id) { res.status(400).json({ error: 'no id' }); return; }
      await sbPatch(`withdrawals?id=eq.${id}`, { status: 'paid', paid_at: new Date().toISOString() });
      res.status(200).json({ ok: true }); return;
    }

    // default: list
    const wds = await sbGet(`withdrawals?select=id,affiliate_code,amount,bank_name,bank_account,account_name,status,created_at,paid_at&order=created_at.desc&limit=50`);

    // tambah whatsapp affiliate untuk hubungi
    const codes = [...new Set(wds.map(w => w.affiliate_code).filter(Boolean))];
    let waMap = {};
    if (codes.length) {
      const affs = await sbGet(`affiliates?code=in.(${codes.map(c => '"' + c + '"').join(',')})&select=code,whatsapp,name`);
      affs.forEach(a => waMap[a.code] = { whatsapp: a.whatsapp, name: a.name });
    }
    wds.forEach(w => {
      const m = waMap[w.affiliate_code] || {};
      w.whatsapp = m.whatsapp || '';
    });

    // ringkasan jualan
    const sales = await sbGet(`sales?select=amount&limit=1000`);
    let revenue = 0; sales.forEach(s => revenue += Number(s.amount) || 0);
    const affCount = await sbGet(`affiliates?active=eq.true&select=code`);

    res.status(200).json({
      withdrawals: wds,
      summary: {
        total_sales: sales.length,
        revenue: Math.round(revenue * 100) / 100,
        active_affiliates: affCount.length
      }
    });

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
