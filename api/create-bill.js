// ════════════════════════════════════════════════════════════
//  /api/create-bill.js  — cipta bill ToyyibPay (server-side)
//  Dipanggil oleh builder bila customer tekan "Bayar".
// ════════════════════════════════════════════════════════════

// Harga dalam SEN (RM8 = 800, RM15 = 1500). Server yang tentukan harga,
// BUKAN client — supaya tak boleh diubah jadi RM0.
// Kunci pelan datang dari gk-bayar.js (CFG.plans). Tambah di sini bila ada produk baru.
const PRICES    = { basic: 600,  premium: 800, bouquet: 300, kahwin: 1500, bayi: 3000, bayi_sambung: 3000, bayi_muka: 500 };
const PLAN_NAME = { basic: 'GiftKita Basic', premium: 'GiftKita Premium', bouquet: 'GiftKita Bouquet Muka', kahwin: 'GiftKita Kad Kahwin', bayi: 'GiftKita Album Baby', bayi_sambung: 'GiftKita Sambung Album Baby', bayi_muka: 'GiftKita Tambah Muka Album' };
const PLAN_DESC = { bouquet: 'Bouquet Muka digital GiftKita', kahwin: 'Kad jemputan kahwin digital GiftKita', bayi: 'Album baby digital GiftKita', bayi_sambung: 'Sambung Album Baby online 1 tahun', bayi_muka: 'Tambah 10 muka surat Album Baby' };   // lalai: 'Kad ucapan digital GiftKita'

// ── DuitNow QR ──
// enableDuitNowQR : '1' hidupkan pilihan QR, '0' matikan
// chargeDuitNowQR : '1' CUSTOMER bayar caj, '0' kita yang bayar
// Caj DNQR = 1% atau RM1, mana lebih tinggi. Pada kad RM6, RM1 itu ~16%,
// jadi caj diletak pada customer. Tukar ke '0' jika mahu tanggung sendiri.
const DNQR_ENABLE = process.env.DNQR_ENABLE || '1';
const DNQR_CHARGE = process.env.DNQR_CHARGE || '1';

module.exports = async (req, res) => {
  // CORS: benarkan panggilan dari GitHub Pages / domain lain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') { res.status(405).json({ error: 'POST sahaja' }); return; }

  try {
    const { cardId, buyerName, buyerEmail, buyerPhone } = req.body || {};
    let plan = (req.body || {}).plan;
    if (cardId) plan = await pelanSebenar(cardId, plan);
    if (!cardId || !PRICES[plan]) { res.status(400).json({ error: 'Data tak lengkap' }); return; }

    const amountCents = PRICES[plan];
    const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
    const TPAY = (process.env.TOYYIBPAY_BASE || 'https://toyyibpay.com').replace(/\/$/, '');
    // Callback MESTI terus ke domain sebenar (www). Kalau SITE_URL kosong / tanpa www, Vercel
    // redirect → ToyyibPay tak ikut redirect → kad tak ditanda paid. (4 Okt 2026)
    const CB_SITE = /^https:\/\/www\./.test(SITE) ? SITE : 'https://www.giftkita.com';

    // 1) cipta bill ToyyibPay
    const form = new URLSearchParams({
      userSecretKey:   process.env.TOYYIBPAY_SECRET,
      categoryCode:    process.env.TOYYIBPAY_CATEGORY,
      billName:        PLAN_NAME[plan],                 // max 30 aksara
      billDescription: PLAN_DESC[plan] || 'Kad ucapan digital GiftKita',
      billPriceSetting:'1',                             // 1 = harga tetap
      billPayorInfo:   '1',                             // prefill maklumat pembeli sebenar
      billAmount:      String(amountCents),             // dalam SEN
      billReturnUrl:   `${SITE}/bayar.html?id=${cardId}`,
      billCallbackUrl: `${CB_SITE}/api/callback`,
      billExternalReferenceNo: cardId,
      billTo:          (buyerName  || 'Pelanggan').slice(0, 30),
      billEmail:       buyerEmail || 'noemail@giftkita.my',
      billPhone:       buyerPhone || '0000000000',
      billPaymentChannel: '0',
      billExpiryDays:  '3',                             // bil luput 3 hari — kad tak bayar dipadam auto selepas 7 hari (docs/sql-bersih-kad.sql)
      enableDuitNowQR: DNQR_ENABLE,
      chargeDuitNowQR: DNQR_CHARGE
    });

    const r = await fetch(`${TPAY}/index.php/api/createBill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const data = await r.json();
    const billCode = Array.isArray(data) && data[0] && data[0].BillCode;
    if (!billCode) { res.status(502).json({ error: 'Gagal cipta bill', detail: data }); return; }

    // 2) simpan bill_code + amount ke card (service key, bypass RLS)
    await sbPatch(`cards?id=eq.${cardId}`, { bill_code: billCode, amount: amountCents / 100, plan });

    // 3) pulangkan URL bayaran
    res.status(200).json({ paymentUrl: `${TPAY}/${billCode}` });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── helper Supabase REST (service key) ──
async function sbGet(path) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/', key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(url + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  return r.json();
}
async function sbPatch(path, body) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: KEY, Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  });
}

// Template tertentu WAJIB guna pelan sendiri (elak bayar harga kad biasa untuk produk RM15/RM30).
const PELAN_TPL = { pelamin: 'kahwin', impian: 'kahwin', bayi: 'bayi', bayi_sambung: 'bayi_sambung', bayi_muka: 'bayi_muka' };
async function pelanSebenar(cardId, plan) {
  try {
    const r = await sbGet(`cards?id=eq.${encodeURIComponent(cardId)}&select=tpl:card_data->>template`);
    const t = Array.isArray(r) && r[0] && r[0].tpl;
    return PELAN_TPL[t] || plan;
  } catch (e) { return plan; }
}
