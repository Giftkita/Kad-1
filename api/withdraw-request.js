// ════════════════════════════════════════════════════════════
//  /api/withdraw-request.js — affiliate tuntut komisen (min RM10)
//  POST {code, bankName, bankAccount, accountName} → {ok, amount}
//  Komisen yang dituntut ditanda paid_out supaya tak double-claim.
// ════════════════════════════════════════════════════════════

const MIN_WITHDRAW = 10; // RM

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    let { code, bankName, bankAccount, accountName } = req.body || {};
    code        = (code        || '').trim().toUpperCase();
    bankName    = (bankName    || '').trim();
    bankAccount = (bankAccount || '').trim();
    accountName = (accountName || '').trim();

    if (!code || !bankName || !bankAccount || !accountName) {
      res.status(400).json({ error: 'Sila isi semua maklumat bank.' }); return;
    }

    // affiliate mesti aktif
    const affs = await sbGet(`affiliates?code=eq.${encodeURIComponent(code)}&active=eq.true&select=code`);
    if (!affs.length) { res.status(400).json({ error: 'Affiliate tidak aktif / tidak dijumpai.' }); return; }

    // kira komisen boleh dituntut
    const comms = await sbGet(`commissions?affiliate_code=eq.${encodeURIComponent(code)}&paid_out=eq.false&select=id,amount`);
    let unpaid = 0;
    comms.forEach(c => unpaid += Number(c.amount) || 0);
    unpaid = Math.round(unpaid * 100) / 100;

    if (unpaid < MIN_WITHDRAW) {
      res.status(400).json({ error: `Minimum tuntutan RM${MIN_WITHDRAW}. Komisen anda sekarang RM${unpaid}.` }); return;
    }

    // rekod tuntutan
    await sbInsert('withdrawals', {
      affiliate_code: code, amount: unpaid,
      bank_name: bankName, bank_account: bankAccount, account_name: accountName,
      status: 'pending'
    });

    // tanda komisen tersebut sebagai dituntut (elak double-claim)
    await sbPatch(`commissions?affiliate_code=eq.${encodeURIComponent(code)}&paid_out=eq.false`, { paid_out: true });

    res.status(200).json({ ok: true, amount: unpaid });

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
