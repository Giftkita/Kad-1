// ════════════════════════════════════════════════════════════
//  /api/recover.js — "Semak Kad Saya": cari semula link kad yang dah dibayar.
//  Dipanggil oleh semak-kad.html dengan { email, phone }.
//
//  Padanan:
//   • email — tak kisah huruf besar/kecil
//   • telefon — banding DIGIT sahaja, 9 digit terakhir. Jadi semua ini sama:
//       012-345 6789  ·  0123456789  ·  +60 12 345 6789  ·  60123456789
//     Nombor luar negara (+1 555…, +44 7…) pun jalan dengan cara yang sama.
//  Kedua-dua MESTI padan — email sahaja tak cukup (link kad ialah hadiah peribadi).
//  Hanya kad yang paid=true dipulangkan. Sokong kad RM (ToyyibPay) & USD (Stripe).
//  PENGAMAN (4 Okt 2026): kad customer yang masih paid=false disemak terus ke
//  ToyyibPay/Stripe — kalau duit dah masuk, kad diaktifkan & dipulangkan.
// ════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '');
    const en = body.lang === 'en';

    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) {
      res.status(200).json({ cards: [], error: en ? 'Please enter a valid email.' : 'Sila masukkan email yang sah.' }); return;
    }
    const kunci = hujungTel(phone);
    if (kunci.length < 7) {
      res.status(200).json({ cards: [], error: en ? 'Please enter the phone number you used when buying.' : 'Sila masukkan no. telefon yang anda guna semasa membeli.' }); return;
    }

    // ilike = tak kisah huruf besar/kecil. Escape % _ supaya tak jadi wildcard.
    const e = email.replace(/[\\%_]/g, m => '\\' + m);
    const rows = await sbGet(
      'cards?buyer_email=ilike.' + encodeURIComponent(e) +
      '&paid=eq.true&select=id,created_at,plan,buyer_phone,template:card_data->>template,plan_lama:card_data->>plan' +
      '&order=created_at.desc&limit=50'
    );

    // PENGAMAN: kad customer ni yang belum ditanda bayar (14 hari) → semak terus ke gateway
    try {
      const belum = await sbGet(
        'cards?buyer_email=ilike.' + encodeURIComponent(e) +
        '&paid=eq.false&bill_code=not.is.null&created_at=gte.' + encodeURIComponent(new Date(Date.now() - 14 * 864e5).toISOString()) +
        '&select=id,paid,amount,ref_code,bill_code,plan,buyer_phone,created_at,template:card_data->>template,plan_lama:card_data->>plan' +
        '&order=created_at.desc&limit=10'
      );
      for (const c of (Array.isArray(belum) ? belum : []).filter(c => hujungTel(c.buyer_phone) === kunci)) {
        try { if (await aktifkanJikaBayar(c)) { c.paid = true; rows.unshift(c); } } catch (x) {}
      }
    } catch (x) {}

    const cards = (Array.isArray(rows) ? rows : [])
      .filter(r => hujungTel(r.buyer_phone) === kunci)
      .slice(0, 20)
      .map(r => ({ id: r.id, created_at: r.created_at, template: r.template || null, plan: r.plan || r.plan_lama || 'basic' }));

    if (!cards.length) {
      res.status(200).json({ cards: [], error: en
        ? 'No cards found. Check that the email & phone number are exactly the ones you used when paying.'
        : 'Tiada kad dijumpai. Semak semula email & no. telefon — mesti sama seperti semasa membayar.' });
      return;
    }
    res.status(200).json({ cards });

  } catch (err) {
    res.status(200).json({ cards: [], error: 'Ralat pelayan / Server error' });
  }
};

// 9 digit terakhir nombor telefon (buang +, 60, sengkang, ruang, kurungan)
function hujungTel(t) {
  const d = String(t || '').replace(/\D/g, '');
  return d.slice(-9);
}

const SB = () => ({ url: process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/', key: process.env.SUPABASE_SERVICE_KEY });
async function sbGet(path) {
  const { url, key } = SB();
  const r = await fetch(url + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  return r.json();
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
