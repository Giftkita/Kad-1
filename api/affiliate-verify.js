// ════════════════════════════════════════════════════════════
//  /api/affiliate-verify.js — sahkan bayaran RM10 & pulangkan statistik
//  POST {code, password} → {active, name, stats, sales, withdrawals, series}
//
//  Sep 2026:
//   • Password WAJIB. Affiliate lama yang belum ada password dapat
//     {needPass:true} dan kena tetapkan password dulu (affiliate-setpass.js,
//     disahkan dengan no. WhatsApp masa daftar).
//   • Komisen DITAHAN HARI_TAHAN hari sebelum boleh dituntut (tempoh refund).
//     stats.unpaid = boleh dituntut sekarang, stats.held = masih ditahan.
//   • sales = senarai 30 jualan terakhir (tarikh, template, RM, status).
// ════════════════════════════════════════════════════════════

const crypto = require('crypto');
function hashPass(pw){ return crypto.createHash('sha256').update('gk::'+pw).digest('hex'); }

const HARI_TAHAN = 7;   // MESTI sama dengan withdraw-request.js

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    let { code, password } = req.body || {};
    code = (code || '').trim().toUpperCase();
    if (!code) { res.status(400).json({ active: false, error: 'no code' }); return; }

    const affs = await sbGet(`affiliates?code=eq.${encodeURIComponent(code)}&select=code,name,active,bill_code,commission_flat,pass_hash`);
    const aff = Array.isArray(affs) ? affs[0] : null;
    if (!aff) { res.status(200).json({ active: false, error: 'Kod tidak dijumpai.' }); return; }

    // password wajib. Affiliate lama tanpa password → minta tetapkan dulu.
    if (!aff.pass_hash) {
      res.status(200).json({ active: false, needPass: true,
        error: 'Akaun anda belum ada password. Sila tetapkan password dahulu.' }); return;
    }
    if (!password || hashPass(String(password)) !== aff.pass_hash) {
      res.status(200).json({ active: false, error: 'Password salah.' }); return;
    }

    // belum aktif? cuba sahkan bayaran RM10 dengan ToyyibPay
    if (aff.active !== true) {
      if (!aff.bill_code) { res.status(200).json({ active: false, error: 'Belum ada bayaran. Sila daftar dahulu.' }); return; }
      const isPaid = await verifyPaid(aff.bill_code);
      if (!isPaid) { res.status(200).json({ active: false }); return; }
      await sbPatch(`affiliates?code=eq.${encodeURIComponent(code)}`, { active: true });
      aff.active = true;
    }

    // ── statistik ──
    const clicks = await sbGet(`affiliate_clicks?code=eq.${encodeURIComponent(code)}&select=id`);
    let comms = await sbGet(`commissions?affiliate_code=eq.${encodeURIComponent(code)}&select=amount,paid_out,created_at,sale_id&order=created_at.desc`);
    if (!Array.isArray(comms)) {   // jaga-jaga kalau lajur created_at tiada
      comms = await sbGet(`commissions?affiliate_code=eq.${encodeURIComponent(code)}&select=amount,paid_out,sale_id`);
      if (!Array.isArray(comms)) comms = [];
    }
    const had = Date.now() - HARI_TAHAN * 864e5;
    let total = 0, unpaid = 0, held = 0;
    comms.forEach(c => {
      const a = Number(c.amount) || 0;
      total += a;
      if (c.paid_out) return;
      const t = c.created_at ? Date.parse(c.created_at) : 0;
      if (t && t > had) held += a; else unpaid += a;
    });

    // ── senarai jualan (30 terakhir): tarikh, template, status ──
    const baru = comms.slice(0, 30);
    const saleIds = baru.map(c => c.sale_id).filter(Boolean);
    let saleMap = {}, cardMap = {};
    if (saleIds.length) {
      const sales = await sbGet(`sales?id=in.(${saleIds.map(encodeURIComponent).join(',')})&select=id,card_id,created_at`);
      if (Array.isArray(sales)) sales.forEach(s => { saleMap[s.id] = s; });
      const cardIds = Object.values(saleMap).map(s => s.card_id).filter(Boolean);
      if (cardIds.length) {
        const cards = await sbGet(`cards?id=in.(${cardIds.map(encodeURIComponent).join(',')})&select=id,plan,template:card_data->>template`);
        if (Array.isArray(cards)) cards.forEach(c => { cardMap[c.id] = c; });
      }
    }
    const senarai = baru.map(c => {
      const s = saleMap[c.sale_id] || {};
      const k = cardMap[s.card_id] || {};
      const bila = c.created_at || s.created_at || null;
      const t = bila ? Date.parse(bila) : 0;
      return {
        date: bila,
        template: k.template || null,
        plan: k.plan || null,
        amount: Number(c.amount) || 0,
        status: c.paid_out ? 'paid' : (t && t > had ? 'held' : 'ready'),
        ready_on: (!c.paid_out && t && t > had) ? new Date(t + HARI_TAHAN * 864e5).toISOString() : null
      };
    });

    // ── sejarah tuntutan ──
    let wds = await sbGet(`withdrawals?affiliate_code=eq.${encodeURIComponent(code)}&select=amount,status,created_at,paid_at&order=created_at.desc&limit=10`);
    if (!Array.isArray(wds)) wds = [];
    let pending = 0, paidOut = 0;
    wds.forEach(w => {
      const a = Number(w.amount) || 0;
      if (w.status === 'paid') paidOut += a; else pending += a;
    });

    const r2 = n => Math.round(n * 100) / 100;

    // ── siri untuk carta: 30 hari & 6 bulan terakhir (waktu Malaysia) ──
    const MYT = 8 * 36e5;
    const hariKey = t => new Date(t + MYT).toISOString().slice(0, 10);
    const bulanKey = t => new Date(t + MYT).toISOString().slice(0, 7);
    const daily = [], monthly = [], dIdx = {}, mIdx = {};
    for (let i = 29; i >= 0; i--) { const k = hariKey(Date.now() - i * 864e5); dIdx[k] = daily.length; daily.push({ d: k, rm: 0, n: 0 }); }
    const kini = new Date(Date.now() + MYT);
    for (let i = 5; i >= 0; i--) {
      const k = new Date(Date.UTC(kini.getUTCFullYear(), kini.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      mIdx[k] = monthly.length; monthly.push({ m: k, rm: 0, n: 0 });
    }
    comms.forEach(c => {
      if (!c.created_at) return;
      const t = Date.parse(c.created_at), a = Number(c.amount) || 0;
      const di = dIdx[hariKey(t)], mi = mIdx[bulanKey(t)];
      if (di != null) { daily[di].rm += a; daily[di].n++; }
      if (mi != null) { monthly[mi].rm += a; monthly[mi].n++; }
    });
    daily.forEach(x => x.rm = r2(x.rm)); monthly.forEach(x => x.rm = r2(x.rm));

    res.status(200).json({
      series: { daily, monthly },
      active: true,
      name: aff.name || '',
      commission_flat: Number(aff.commission_flat) || 2,
      hold_days: HARI_TAHAN,
      stats: {
        clicks: Array.isArray(clicks) ? clicks.length : 0,
        sales: comms.length,
        total: r2(total),
        unpaid: r2(unpaid),     // boleh dituntut sekarang
        held: r2(held),         // masih dalam tempoh tahan
        pending: r2(pending),
        paid: r2(paidOut)
      },
      sales: senarai,
      withdrawals: wds
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
