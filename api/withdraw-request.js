// ════════════════════════════════════════════════════════════
//  /api/withdraw-request.js — affiliate tuntut komisen (min RM10)
//  POST {code, password, bankName, bankAccount, accountName} → {ok, amount}
//
//  Sep 2026:
//   • Password WAJIB (sama dengan affiliate-verify.js).
//   • Komisen DITAHAN HARI_TAHAN hari (tempoh refund). Hanya komisen yang
//     lebih lama dari tu boleh dituntut. Yang masih ditahan kekal paid_out:false
//     dan boleh dituntut kemudian.
//   • Hanya baris komisen yang betul-betul dituntut ditanda paid_out (ikut id),
//     supaya komisen baru yang masuk serentak tak tertanda sekali.
// ════════════════════════════════════════════════════════════

const MIN_WITHDRAW = 10; // RM
const HARI_TAHAN  = 7;   // MESTI sama dengan affiliate-verify.js

const crypto = require('crypto');
function hashPass(pw){ return crypto.createHash('sha256').update('gk::'+pw).digest('hex'); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    let { code, password, bankName, bankAccount, accountName } = req.body || {};
    code        = (code        || '').trim().toUpperCase();
    bankName    = (bankName    || '').trim().slice(0, 60);
    bankAccount = (bankAccount || '').trim().slice(0, 40);
    accountName = (accountName || '').trim().slice(0, 80);

    if (!code || !bankName || !bankAccount || !accountName) {
      res.status(400).json({ error: 'Sila isi semua maklumat bank.' }); return;
    }

    // affiliate mesti aktif & password betul
    const affs = await sbGet(`affiliates?code=eq.${encodeURIComponent(code)}&active=eq.true&select=code,pass_hash`);
    if (!Array.isArray(affs) || !affs.length) { res.status(400).json({ error: 'Affiliate tidak aktif / tidak dijumpai.' }); return; }
    if (!affs[0].pass_hash) { res.status(400).json({ error: 'Sila tetapkan password dahulu di halaman affiliate.' }); return; }
    if (!password || hashPass(String(password)) !== affs[0].pass_hash) {
      res.status(400).json({ error: 'Password salah. Tuntutan dibatalkan.' }); return;
    }

    // komisen belum dituntut
    let comms = await sbGet(`commissions?affiliate_code=eq.${encodeURIComponent(code)}&paid_out=eq.false&select=id,amount,created_at`);
    if (!Array.isArray(comms)) {   // jaga-jaga kalau lajur created_at tiada
      comms = await sbGet(`commissions?affiliate_code=eq.${encodeURIComponent(code)}&paid_out=eq.false&select=id,amount`);
      if (!Array.isArray(comms)) comms = [];
    }

    // hanya yang dah lepas tempoh tahan
    const had = Date.now() - HARI_TAHAN * 864e5;
    const layak = comms.filter(c => !c.created_at || Date.parse(c.created_at) <= had);
    let jumlah = 0, ditahan = 0;
    layak.forEach(c => jumlah += Number(c.amount) || 0);
    comms.forEach(c => { if (layak.indexOf(c) < 0) ditahan += Number(c.amount) || 0; });
    jumlah = Math.round(jumlah * 100) / 100;
    ditahan = Math.round(ditahan * 100) / 100;

    if (jumlah < MIN_WITHDRAW) {
      res.status(400).json({ error: `Minimum tuntutan RM${MIN_WITHDRAW}. Boleh dituntut sekarang: RM${jumlah}` +
        (ditahan ? ` (RM${ditahan} lagi masih ditahan ${HARI_TAHAN} hari).` : '.') }); return;
    }

    // rekod tuntutan
    await sbInsert('withdrawals', {
      affiliate_code: code, amount: jumlah,
      bank_name: bankName, bank_account: bankAccount, account_name: accountName,
      status: 'pending'
    });

    // tanda HANYA komisen yang dituntut (ikut id)
    const ids = layak.map(c => c.id).filter(Boolean);
    for (let i = 0; i < ids.length; i += 100) {
      const kumpulan = ids.slice(i, i + 100).map(encodeURIComponent).join(',');
      await sbPatch(`commissions?id=in.(${kumpulan})&paid_out=eq.false`, { paid_out: true });
    }

    res.status(200).json({ ok: true, amount: jumlah, held: ditahan });

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
