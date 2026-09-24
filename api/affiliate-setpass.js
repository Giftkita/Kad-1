// ════════════════════════════════════════════════════════════
//  /api/affiliate-setpass.js — affiliate LAMA (belum ada password)
//  tetapkan password sendiri, disahkan dengan no. WhatsApp masa daftar.
//  POST {code, phone, password} → {ok:true}
//
//  TUKAR password (affiliate yang dah log masuk):
//  POST {code, oldPassword, password} → {ok:true}
//
//  Hanya jalan kalau akaun BELUM ada password. Kalau dah ada dan lupa,
//  affiliate kena WhatsApp admin → admin reset di admin.html (api/admin.js, action reset_pass).
// ════════════════════════════════════════════════════════════
const crypto = require('crypto');
function hashPass(pw){ return crypto.createHash('sha256').update('gk::'+pw).digest('hex'); }
const hujung = t => String(t || '').replace(/\D/g, '').slice(-9);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }
  try {
    let { code, phone, password, oldPassword } = req.body || {};
    code = String(code || '').trim().toUpperCase();

    // ── mod TUKAR password: sahkan password semasa ──
    if (oldPassword != null) {
      if (!code) { res.status(200).json({ ok: false, error: 'Kod affiliate tiada.' }); return; }
      if (!password || String(password).length < 6) { res.status(200).json({ ok: false, error: 'Password baru mesti sekurang-kurangnya 6 aksara.' }); return; }
      const r0 = await sbGet(`affiliates?code=eq.${encodeURIComponent(code)}&select=code,pass_hash`);
      const a0 = Array.isArray(r0) ? r0[0] : null;
      if (!a0 || !a0.pass_hash || hashPass(String(oldPassword)) !== a0.pass_hash) {
        await new Promise(r => setTimeout(r, 800));
        res.status(200).json({ ok: false, error: 'Password semasa salah.' }); return;
      }
      await sbPatch(`affiliates?code=eq.${encodeURIComponent(code)}`, { pass_hash: hashPass(String(password)) });
      res.status(200).json({ ok: true }); return;
    }

    if (!code || hujung(phone).length < 7) { res.status(200).json({ ok: false, error: 'Isi kod affiliate dan no. WhatsApp.' }); return; }
    if (!password || String(password).length < 6) { res.status(200).json({ ok: false, error: 'Password mesti sekurang-kurangnya 6 aksara.' }); return; }

    const rows = await sbGet(`affiliates?code=eq.${encodeURIComponent(code)}&select=code,whatsapp,pass_hash`);
    const a = Array.isArray(rows) ? rows[0] : null;
    // mesej sama untuk "tiada kod" & "nombor salah" supaya orang tak boleh teka kod
    if (!a || hujung(a.whatsapp) !== hujung(phone)) {
      res.status(200).json({ ok: false, error: 'Kod atau no. WhatsApp tidak sepadan.' }); return;
    }
    if (a.pass_hash) {
      res.status(200).json({ ok: false, error: 'Akaun ini dah ada password. Lupa password? WhatsApp admin GiftKita.' }); return;
    }
    await sbPatch(`affiliates?code=eq.${encodeURIComponent(code)}`, { pass_hash: hashPass(String(password)) });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message });
  }
};

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
