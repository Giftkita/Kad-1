// ════════════════════════════════════════════════════════════
//  /api/admin.js — panel admin (dilindungi ADMIN_TOKEN)
//  POST {token, action:'list'}                → tuntutan + ringkasan
//  POST {token, action:'mark_paid', id}       → tanda tuntutan dibayar
//  POST {token, action:'reset_pass', code}    → password sementara affiliate
//  POST {token, action:'dashboard'}           → data untuk dashboard admin.html
//  POST {token, action:'get_notice' | 'set_notice', notice} → notis & penyelenggaraan
//  POST {token, action:'kapasiti'}          → saiz pangkalan data Supabase + trafik Vercel bulan ini
//  GET  /api/admin?notis=1                    → AWAM: notis semasa (untuk gk-notis.js)
//  POST {action:'lawat', p,s,d,i,b}           → AWAM: catat 1 lawatan (gk-notis.js / gk-bayar.js)
//  POST {token, action:'pelawat', hari}       → data lawatan untuk tab Pelawat
//  POST {token, action:'baru', since}         → jualan selepas 'since' (notifikasi admin)
//  POST {token, action:'tertunda', hari}      → semak kad belum bayar & aktifkan yang duitnya dah masuk
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

  // ── AWAM: catat lawatan (tanpa token) ──
  if ((req.body || {}).action === 'lawat') { try { await catatLawatan(req); } catch (e) {} res.status(204).end(); return; }

  try {
    const { token, action, id, code } = req.body || {};
    if (!tokenBetul(token)) {
      await new Promise(r => setTimeout(r, 800));   // perlahankan cubaan teka
      res.status(401).json({ error: 'Token salah.' }); return;
    }

    // semak semua kad belum bayar (7 hari) yang ada bill → aktifkan yang duitnya dah masuk
    if (action === 'tertunda') {
      const hari = Math.min(30, Math.max(1, Number((req.body || {}).hari) || 7));
      const sejak = new Date(Date.now() - hari * 864e5).toISOString();
      const belum = await sbGet(`cards?paid=eq.false&bill_code=not.is.null&created_at=gte.${encodeURIComponent(sejak)}` +
        `&select=id,paid,amount,ref_code,bill_code,plan,buyer_email,created_at,template:card_data->>template,plan_lama:card_data->>plan&order=created_at.desc&limit=150`);
      const senarai = Array.isArray(belum) ? belum : [];
      const aktif = [];
      for (const c of senarai) {
        try { if (await aktifkanJikaBayar(c)) aktif.push({ id: c.id, template: c.template, plan: c.plan || c.plan_lama, email: c.buyer_email, created_at: c.created_at }); } catch (x) {}
      }
      res.status(200).json({ ok: true, disemak: senarai.length, aktif }); return;
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
    if (action === 'kapasiti') {
      res.status(200).json({ db: await kapasitiDb(), vercel: await kapasitiVercel(), now: new Date().toISOString() });
      return;
    }

    if (action === 'baru') {
      const since = String((req.body || {}).since || '');
      if (isNaN(Date.parse(since))) { res.status(200).json({ sales: [], now: new Date().toISOString() }); return; }
      const rows = await sbGet(`sales?select=id,card_id,amount,bill_code,created_at&created_at=gt.${encodeURIComponent(new Date(since).toISOString())}&order=created_at.asc&limit=20`);
      const arr = Array.isArray(rows) ? rows : [];
      const ids = [...new Set(arr.map(r => r.card_id).filter(Boolean))].map(encodeURIComponent).join(',');
      const kad = {};
      if (ids) { const cs = await sbGet(`cards?id=in.(${ids})&select=id,plan,buyer_name,template:card_data->>template,plan_lama:card_data->>plan`); (Array.isArray(cs) ? cs : []).forEach(c => { kad[c.id] = c; }); }
      res.status(200).json({ now: new Date().toISOString(), sales: arr.map(r => { const c = kad[r.card_id] || {};
        return { id: r.id, t: r.created_at, rm: Number(r.amount) || 0, tpl: c.template || '', plan: c.plan || c.plan_lama || '', gw: /^cs_/.test(r.bill_code || '') ? 'usd' : 'rm', nama: String(c.buyer_name || '').slice(0, 40) }; }) });
      return;
    }

    if (action === 'pelawat') {
      const hari = Math.min(Math.max(parseInt((req.body || {}).hari, 10) || 30, 1), 366);
      const dari = new Date(Date.now() - hari * 864e5).toISOString();
      const rows = await sbAll(`lawatan?select=t,page,sumber,negara,peranti,sesi,baru&t=gte.${encodeURIComponent(dari)}&order=t.desc`);
      if (!Array.isArray(rows)) { res.status(200).json({ error: 'Jadual "lawatan" belum ada dalam Supabase. Jalankan SQL dalam BACA-SAYA (bahagian Pelawat) sekali sahaja.' }); return; }
      res.status(200).json({ rows, hari, now: new Date().toISOString() }); return;
    }

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

// ── PELAWAT: satu baris setiap paparan page (tiada data peribadi: tiada IP, tiada nama) ──
async function catatLawatan(req) {
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios/i.test(ua)) return;
  const b = req.body || {};
  const page = String(b.p || '/').slice(0, 80);
  if (!/^\/[a-z0-9._\/-]*$/i.test(page)) return;
  const sumber = String(b.s || 'terus').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'terus';
  const sesi = String(b.i || '').replace(/[^a-z0-9]/g, '').slice(0, 16);
  const row = { page, sumber, negara: String(req.headers['x-vercel-ip-country'] || '').slice(0, 2).toUpperCase(),
    peranti: b.d === 'mobile' ? 'mobile' : 'desktop', sesi, baru: b.b === true };
  const { url, key } = SB();
  await fetch(url + 'lawatan', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) });
}

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

// ── KAPASITI: amaran awal sebelum had pelan percuma penuh ──
// Supabase: perlukan fungsi SQL public.saiz_db() (docs/sql-kapasiti.sql, jalan sekali).
async function kapasitiDb() {
  const HAD = 500 * 1024 * 1024;   // pelan Free: 500MB (jadi read-only bila lepas)
  try {
    const { url, key } = SB();
    const r = await fetch(url + 'rpc/saiz_db', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json();
    const b = typeof j === 'number' ? j : Number(j && (j.saiz_db ?? j[0]?.saiz_db));
    if (!r.ok || !isFinite(b)) return { error: 'sql', detail: (j && j.message) || String(r.status) };
    return { bytes: b, limit: HAD };
  } catch (e) { return { error: 'gagal', detail: String(e.message || e) }; }
}
// Vercel: perlukan env VERCEL_TOKEN (vercel.com/account/tokens), pilihan VERCEL_TEAM_ID.
// Guna /v1/billing/charges (format FOCUS, JSONL, harian). Jumlah "Fast Data Transfer" bulan ini.
async function kapasitiVercel() {
  const HAD_GB = 100;              // pelan Hobby: 100GB Fast Data Transfer sebulan
  const T = process.env.VERCEL_TOKEN;
  if (!T) return { error: 'no_token', limit: HAD_GB };
  try {
    const now = new Date(), mula = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const q = new URLSearchParams({ from: mula.toISOString(), to: now.toISOString() });
    if (process.env.VERCEL_TEAM_ID) q.set('teamId', process.env.VERCEL_TEAM_ID);
    const r = await fetch('https://api.vercel.com/v1/billing/charges?' + q, { headers: { Authorization: 'Bearer ' + T } });
    const txt = await r.text();
    if (!r.ok) return { error: 'api', status: r.status, detail: txt.slice(0, 160), limit: HAD_GB };
    const baris = txt.split('\n').map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    const rekod = baris.length === 1 && Array.isArray(baris[0]) ? baris[0] : (baris.length === 1 && Array.isArray(baris[0].data) ? baris[0].data : baris);
    let gb = 0, jumpa = 0;
    for (const x of rekod) {
      const nama = [x.ServiceName, x.ChargeDescription, x.SkuMeter, x.SkuId, x.ResourceName, x.ChargeCategory].filter(Boolean).join(' ');
      if (!/fast\s*data\s*transfer/i.test(nama)) continue;
      const qty = Number(x.ConsumedQuantity ?? x.PricingQuantity ?? 0); if (!isFinite(qty)) continue;
      const unit = String(x.ConsumedUnit || x.PricingUnit || 'GB').toLowerCase();
      gb += /^b(yte)?s?$/.test(unit) ? qty / 1e9 : /mb/.test(unit) ? qty / 1e3 : /tb/.test(unit) ? qty * 1e3 : qty;
      jumpa++;
    }
    return { gb: Math.round(gb * 100) / 100, limit: HAD_GB, rows: jumpa, from: mula.toISOString() };
  } catch (e) { return { error: 'gagal', detail: String(e.message || e), limit: HAD_GB }; }
}

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

// ════════════════════════════════════════════════════════════
//  PENGAMAN BAYARAN TERSANGKUT (4 Okt 2026)
//  Kalau callback ToyyibPay tak sampai & customer tak kembali ke bayar.html,
//  kad kekal paid=false walaupun duit dah masuk. Fungsi ni semak terus ke
//  ToyyibPay / Stripe dan aktifkan kad — logik SAMA dengan verify.js.
// ════════════════════════════════════════════════════════════
const TIADA_KOMISEN_A = { bouquet: true };
async function aktifkanJikaBayar(card) {
  if (!card || card.paid === true || !card.bill_code) return false;
  let myr = null;
  if (/^cs_/.test(card.bill_code)) {
    if (!process.env.STRIPE_SECRET_KEY) return false;
    const q = 'expand[]=payment_intent.latest_charge.balance_transaction';
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(card.bill_code)}?${q}`,
      { headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY } });
    const s = await r.json();
    if (!s || s.payment_status !== 'paid') return false;
    try { const bt = s.payment_intent.latest_charge.balance_transaction; if (bt && bt.currency === 'myr') myr = Math.round(bt.amount) / 100; } catch (e) {}
  } else {
    const TPAY = (process.env.TOYYIBPAY_BASE || 'https://toyyibpay.com').replace(/\/$/, '');
    const form = new URLSearchParams({ userSecretKey: process.env.TOYYIBPAY_SECRET, billCode: card.bill_code });
    const r = await fetch(`${TPAY}/index.php/api/getBillTransactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    const data = await r.json().catch(() => null);
    if (!(Array.isArray(data) && data.some(t => String(t.billpaymentStatus) === '1'))) return false;
  }
  await sbPatchA(`cards?id=eq.${card.id}`, myr ? { paid: true, amount: myr } : { paid: true });
  const ada = await sbGetA(`sales?bill_code=eq.${encodeURIComponent(card.bill_code)}&select=id`);
  if (!Array.isArray(ada) || !ada.length) {
    const sale = await sbInsertA('sales', { card_id: card.id, ref_code: card.ref_code, amount: myr || card.amount, bill_code: card.bill_code, status: 'paid' });
    const saleId = Array.isArray(sale) && sale[0] && sale[0].id;
    const plan = card.plan || card.plan_lama || 'basic';
    if (card.ref_code && saleId && !TIADA_KOMISEN_A[plan]) {
      const aff = await sbGetA(`affiliates?code=eq.${encodeURIComponent(card.ref_code)}&active=eq.true&select=code,commission_flat`);
      if (Array.isArray(aff) && aff.length) {
        await sbInsertA('commissions', { affiliate_code: card.ref_code, sale_id: saleId, amount: Number(aff[0].commission_flat) || 2, paid_out: false });
      }
    }
  }
  return true;
}
const SBA = () => ({ url: process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/', key: process.env.SUPABASE_SERVICE_KEY });
async function sbGetA(path) { const { url, key } = SBA(); const r = await fetch(url + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } }); return r.json(); }
async function sbPatchA(path, body) { const { url, key } = SBA(); await fetch(url + path, { method: 'PATCH', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) }); }
async function sbInsertA(table, row) { const { url, key } = SBA(); const r = await fetch(url + table, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) }); return r.json(); }
