// ════════════════════════════════════════════════════════════
//  /api/admin.js — panel admin (dilindungi ADMIN_TOKEN)
//  POST {token, action:'list'}                → tuntutan + ringkasan
//  POST {token, action:'mark_paid', id}       → tanda tuntutan dibayar
//  POST {token, action:'reset_pass', code}    → password sementara affiliate
//  POST {token, action:'dashboard'}           → data untuk dashboard admin.html
//  POST {token, action:'get_notice' | 'set_notice', notice} → notis & penyelenggaraan
//  GET  /api/admin?notis=1                    → AWAM: notis semasa (untuk gk-notis.js)
//
//  Sep 2026: token dibanding secara timing-safe, id dienkod, dan reset
//  password affiliate kini di sini (tak perlu ADMIN_KEY / affiliate-reset.js).
// ════════════════════════════════════════════════════════════
const crypto = require('crypto');
function hashPass(pw){ return crypto.createHash('sha256').update('gk::'+pw).digest('hex'); }
function tokenBetul(t){
  const A = process.env.ADMIN_TOKEN || '';
  if (!A) return false;
  const a = Buffer.from(String(t || '')), b = Buffer.from(A);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── AWAM: GET /api/admin?notis=1 → notis semasa untuk gk-notis.js ──
  // (dikongsi dalam fail ni supaya tak tambah fungsi Vercel baru — had pelan Hobby 12 fungsi)
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    try { res.status(200).json(awam(await bacaNotis())); } catch (e) { res.status(200).json({}); }
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    const { token, action, id, code } = req.body || {};
    if (!tokenBetul(token)) {
      await new Promise(r => setTimeout(r, 800));   // perlahankan cubaan teka
      res.status(401).json({ error: 'Token salah.' }); return;
    }

    if (action === 'mark_paid') {
      if (!id) { res.status(400).json({ error: 'no id' }); return; }
      await sbPatch(`withdrawals?id=eq.${encodeURIComponent(id)}`, { status: 'paid', paid_at: new Date().toISOString() });
      res.status(200).json({ ok: true }); return;
    }

    if (action === 'reset_pass') {
      const c = String(code || '').trim().toUpperCase();
      if (!c) { res.status(400).json({ error: 'Masukkan kod affiliate.' }); return; }
      const rows = await sbGet(`affiliates?code=eq.${encodeURIComponent(c)}&select=code,name,whatsapp`);
      const aff = Array.isArray(rows) ? rows[0] : null;
      if (!aff) { res.status(404).json({ error: 'Kod affiliate tidak dijumpai.' }); return; }
      // 8 aksara, tanpa huruf mengelirukan (0/O, 1/l/I)
      const abjad = 'abcdefghjkmnpqrstuvwxyz23456789';
      const bytes = crypto.randomBytes(8);
      let temp = ''; for (let i = 0; i < 8; i++) temp += abjad[bytes[i] % abjad.length];
      await sbPatch(`affiliates?code=eq.${encodeURIComponent(c)}`, { pass_hash: hashPass(temp) });
      res.status(200).json({ ok: true, code: aff.code, name: aff.name || '', whatsapp: aff.whatsapp || '', tempPassword: temp });
      return;
    }

    // ── NOTIS & PENYELENGGARAAN ──
    if (action === 'get_notice') {
      const r = await sbGet(`settings?key=eq.notice&select=value,updated_at`);
      if (!Array.isArray(r)) { res.status(200).json({ error: JADUAL_TIADA }); return; }
      res.status(200).json({ notice: (r[0] && r[0].value) || {}, updated_at: r[0] && r[0].updated_at }); return;
    }
    if (action === 'set_notice') {
      const n = bersih((req.body || {}).notice || {});
      const { url, key } = SB();
      const r = await fetch(url + 'settings?on_conflict=key', {
        method: 'POST',
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: 'notice', value: n, updated_at: new Date().toISOString() })
      });
      if (!r.ok) { const t = await r.text(); res.status(200).json({ error: /settings/.test(t) ? JADUAL_TIADA : ('Gagal simpan: ' + t.slice(0, 160)) }); return; }
      res.status(200).json({ ok: true, notice: n }); return;
    }

    // ── DASHBOARD: semua data mentah yang ringkas, dikira di browser ──
    if (action === 'dashboard') {
      const arr = x => Array.isArray(x) ? x : [];
      let sales = arr(await sbAll(`sales?select=id,card_id,ref_code,amount,bill_code,created_at&order=created_at.desc`));
      if (!sales.length) sales = arr(await sbAll(`sales?select=id,card_id,ref_code,amount,bill_code`));

      // maklumat kad (template, pakej, nama pembeli) — ambil medan kecil sahaja, bukan gambar
      const kad = {};
      const ids = [...new Set(sales.map(s => s.card_id).filter(Boolean))];
      for (let i = 0; i < ids.length; i += 120) {
        const kump = ids.slice(i, i + 120).map(encodeURIComponent).join(',');
        const rows = arr(await sbGet(`cards?id=in.(${kump})&select=id,plan,buyer_name,created_at,template:card_data->>template,plan_lama:card_data->>plan`));
        rows.forEach(c => { kad[c.id] = c; });
      }
      const jualan = sales.map(s => {
        const c = kad[s.card_id] || {};
        return {
          t: s.created_at || c.created_at || null,
          rm: Number(s.amount) || 0,
          tpl: c.template || '',
          plan: c.plan || c.plan_lama || '',
          ref: s.ref_code || '',
          gw: /^cs_/.test(s.bill_code || '') ? 'usd' : 'rm',
          nama: String(c.buyer_name || '').slice(0, 40)
        };
      });

      let comms = arr(await sbAll(`commissions?select=affiliate_code,amount,paid_out,created_at`));
      if (!comms.length) comms = arr(await sbAll(`commissions?select=affiliate_code,amount,paid_out`));
      const affs = arr(await sbGet(`affiliates?select=code,name,whatsapp,active`));
      const klik = arr(await sbAll(`affiliate_clicks?select=code`));
      const wds = arr(await sbGet(`withdrawals?select=id,affiliate_code,amount,bank_name,bank_account,account_name,status,created_at,paid_at&order=created_at.desc&limit=100`));

      const HARI_TAHAN = 7, had = Date.now() - HARI_TAHAN * 864e5;
      const peta = {};
      affs.forEach(a => { peta[a.code] = { code: a.code, name: a.name || '', whatsapp: a.whatsapp || '', active: a.active === true,
        clicks: 0, sales: 0, komisen: 0, unpaid: 0, held: 0, paid: 0 }; });
      klik.forEach(k => { if (peta[k.code]) peta[k.code].clicks++; });
      comms.forEach(c => {
        const p = peta[c.affiliate_code]; if (!p) return;
        const a = Number(c.amount) || 0;
        p.sales++; p.komisen += a;
        if (c.paid_out) p.paid += a;
        else if (c.created_at && Date.parse(c.created_at) > had) p.held += a;
        else p.unpaid += a;
      });
      const r2 = n => Math.round(n * 100) / 100;
      const senaraiAff = Object.values(peta).map(p => ({ ...p, komisen: r2(p.komisen), unpaid: r2(p.unpaid), held: r2(p.held), paid: r2(p.paid) }));
      wds.forEach(w => { const p = peta[w.affiliate_code] || {}; w.whatsapp = p.whatsapp || ''; w.name = p.name || ''; });

      res.status(200).json({ sales: jualan, affiliates: senaraiAff, withdrawals: wds, hold_days: HARI_TAHAN, now: new Date().toISOString() });
      return;
    }

    // default: list
    const wds = await sbGet(`withdrawals?select=id,affiliate_code,amount,bank_name,bank_account,account_name,status,created_at,paid_at&order=created_at.desc&limit=50`);

    // tambah whatsapp affiliate untuk hubungi
    const codes = [...new Set(wds.map(w => w.affiliate_code).filter(Boolean))];
    let waMap = {};
    if (codes.length) {
      const affs = await sbGet(`affiliates?code=in.(${codes.map(c => '"' + encodeURIComponent(c) + '"').join(',')})&select=code,whatsapp,name`);
      affs.forEach(a => waMap[a.code] = { whatsapp: a.whatsapp, name: a.name });
    }
    wds.forEach(w => {
      const m = waMap[w.affiliate_code] || {};
      w.whatsapp = m.whatsapp || '';
      w.name = m.name || '';
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

// ── notis: bersihkan input admin & versi awam ──
const JADUAL_TIADA = 'Jadual "settings" belum ada dalam Supabase. Jalankan SQL dalam BACA-SAYA (bahagian Notis) sekali sahaja.';
function bersih(n) {
  const teks = (v, max) => String(v || '').replace(/\r/g, '').trim().slice(0, max);
  const until = n.until && !isNaN(Date.parse(n.until)) ? new Date(n.until).toISOString() : null;
  return {
    on: n.on === true,
    jenis: ['info', 'maint', 'warn'].includes(n.jenis) ? n.jenis : 'info',
    msg_ms: teks(n.msg_ms, 300),
    msg_en: teks(n.msg_en, 300),
    until,
    tutup: n.tutup === true,
    templates: (Array.isArray(n.templates) ? n.templates : []).map(String).filter(k => /^[a-z0-9-]{2,40}$/.test(k)).slice(0, 30)
  };
}
async function bacaNotis() {
  const r = await sbGet(`settings?key=eq.notice&select=value`);
  return Array.isArray(r) && r[0] ? r[0].value || {} : {};
}
function awam(n) { return bersih(n || {}); }

// ── helper Supabase REST (service key) ──
const SB = () => ({ url: process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/', key: process.env.SUPABASE_SERVICE_KEY });
async function sbGet(path) {
  const { url, key } = SB();
  const r = await fetch(url + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  return r.json();
}
// Supabase pulangkan maksimum 1000 baris sekali; ambil berhalaman (had 20k baris)
async function sbAll(path) {
  let semua = [];
  for (let off = 0; off < 20000; off += 1000) {
    const r = await sbGet(`${path}&limit=1000&offset=${off}`);
    if (!Array.isArray(r)) return off ? semua : r;
    semua = semua.concat(r);
    if (r.length < 1000) break;
  }
  return semua;
}
async function sbPatch(path, bodyObj) {
  const { url, key } = SB();
  await fetch(url + path, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(bodyObj)
  });
}
