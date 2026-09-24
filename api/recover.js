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
