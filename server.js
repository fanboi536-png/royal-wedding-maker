const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. CLOUDINARY CONFIG
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. RAZORPAY CONFIG
const razorpay = process.env.RAZORPAY_KEY_ID
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

// 3. MONGODB CONNECTION + AUTO-DELETE (1 Hr Unpaid / 15 Days Paid)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Error:', err));

const cardSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  groomName: String,
  groomParents: String,
  brideName: String,
  brideParents: String,
  weddingDate: String,
  venueName: String,
  venueAddress: String,
  whatsappNumber: String,
  buyerEmail: { type: String, default: '' },
  groomPhoto: String,
  bridePhoto: String,
  events: Array,
  blessings: Array,
  theme: { type: String, default: 'royal-maroon' },
  design: { type: String, default: 'royal-palace' },
  isPaid: { type: Boolean, default: false },
  paymentId: { type: String, default: '' },
  expireAt: { type: Date, index: { expires: 0 } }
});

const Card = mongoose.model('Card', cardSchema);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'royal_wedding_cards', quality: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// HELPER: NORMALIZE EVENTS SO EVERY TEMPLATE READS THEM PROPERLY
function normalizeEvents(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((ev) => ev && (ev.name || ev.title))
    .slice(0, 12)
    .map((ev) => {
      const evName = String(ev.name || ev.title || '').trim().slice(0, 60);
      const evTime = String(ev.time || ev.date || '').trim().slice(0, 50);
      const evVenue = String(ev.venue || '').trim().slice(0, 80);
      return {
        name: evName,
        title: evName,
        time: evTime,
        date: evTime,
        venue: evVenue
      };
    });
}

// HELPER: READ TEMPLATES LIST DYNAMICALLY
function getTemplatesList() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'public', 'templates.json'), 'utf8');
    const list = JSON.parse(raw);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {
    console.error('templates.json read warning:', err.message);
  }
  return [
    { id: 'royal-palace', name: 'Royal Palace', file: 'card.html' },
    { id: 'shahi-scroll', name: 'Shahi Scroll', file: 'scroll-card.html' },
    { id: 'shahi-darbar', name: 'Shahi Darbar', file: 'darbar-card.html' },
    { id: 'shahi-parda', name: 'Shahi Parda', file: 'curtain-card.html' },
    { id: 'pre-wedding-album', name: 'Photo Album', file: 'album-card.html' }
  ];
}

// HELPER: MINI INVOICE + CARD LINK EMAIL
async function sendInvoiceEmail({ toEmail, card, paymentId, orderId, cardLink }) {
  if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL || !toEmail) return;

  const templates = getTemplatesList();
  const matched = templates.find((t) => t.id === card.design);
  const designLabel = matched ? matched.name : 'Royal Wedding Card';

  const paidDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
  });
  const validTill = new Date(card.expireAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
  });

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:2px solid #d4af37;border-radius:14px;overflow:hidden;background:#fffaf0;color:#2c0609;">
      <div style="background:#4a0404;color:#f9e79f;padding:20px;text-align:center;">
        <h2 style="margin:0;font-size:20px;">✨ Royal Wedding Invitation Unlocked!</h2>
        <p style="margin:6px 0 0;font-size:13px;color:#f7eedc;">${card.groomName} ❤️ ${card.brideName}</p>
      </div>
      <div style="padding:20px;">
        <p style="font-size:14px;line-height:1.5;margin-top:0;">Namaste! Aapka digital wedding card watermark-free unlock ho gaya hai. Neeche diye button se card kholein aur WhatsApp par share karein:</p>
        <div style="text-align:center;margin:22px 0;">
          <a href="${cardLink}" style="background:#800000;color:#f9e79f;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">Open Your Wedding Card 💌</a>
        </div>
        <p style="font-size:12px;word-break:break-all;background:#f5ebd6;padding:10px;border-radius:6px;">
          <strong>Direct Share Link:</strong><br/>
          <a href="${cardLink}" style="color:#800000;">${cardLink}</a>
        </p>
        <hr style="border:none;border-top:1px dashed #d4af37;margin:18px 0;" />
        <h3 style="margin:0 0 10px;font-size:14px;color:#4a0404;">🧾 Payment Receipt / Mini Invoice</h3>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#666;">Payment ID:</td><td style="text-align:right;font-weight:bold;">${paymentId}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Order ID:</td><td style="text-align:right;">${orderId}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Card Design:</td><td style="text-align:right;">${designLabel} (15 Days)</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Date:</td><td style="text-align:right;">${paidDate}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Valid Till:</td><td style="text-align:right;">${validTill}</td></tr>
          <tr style="border-top:1px solid #e0cfa9;"><td style="padding:8px 0;font-weight:bold;">Total Paid:</td><td style="padding:8px 0;text-align:right;font-weight:bold;color:#166534;">₹29.00 (Paid)</td></tr>
        </table>
      </div>
    </div>
  `;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Royal Wedding Invitations', email: process.env.SENDER_EMAIL },
      to: [{ email: toEmail }],
      subject: `🎉 Your Wedding Card Link & Invoice (${card.groomName} & ${card.brideName})`,
      htmlContent
    })
  });

  if (!response.ok) {
    console.error('❌ Brevo Email Error:', await response.text());
  }
}

// 4. API: FREE PREVIEW CARD BANAYEIN
app.post(
  '/api/create-preview',
  upload.fields([
    { name: 'groomPhoto', maxCount: 1 },
    { name: 'bridePhoto', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        groomName,
        groomParents,
        brideName,
        brideParents,
        weddingDate,
        venueName,
        venueAddress,
        whatsappNumber,
        eventsJson,
        theme,
        design
      } = req.body;

      let groomPhotoUrl = '';
      let bridePhotoUrl = '';

      if (req.files && req.files['groomPhoto']) {
        groomPhotoUrl = await uploadToCloudinary(req.files['groomPhoto'][0].buffer);
      }
      if (req.files && req.files['bridePhoto']) {
        bridePhotoUrl = await uploadToCloudinary(req.files['bridePhoto'][0].buffer);
      }

      let rawEvents = [];
      try {
        rawEvents = JSON.parse(eventsJson || req.body.events || '[]');
      } catch (_) {
        rawEvents = [];
      }
      const normalizedEvents = normalizeEvents(rawEvents);

      const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'royal';
      const cardId = `${clean(groomName)}-weds-${clean(brideName)}-${crypto.randomBytes(3).toString('hex')}`;
      const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);

      const newCard = await Card.create({
        id: cardId,
        groomName: groomName.trim(),
        groomParents: groomParents?.trim() || '',
        brideName: brideName.trim(),
        brideParents: brideParents?.trim() || '',
        weddingDate,
        venueName: venueName?.trim() || 'Royal Palace',
        venueAddress: venueAddress?.trim() || '',
        whatsappNumber: (whatsappNumber || '').replace(/\D/g, ''),
        groomPhoto: groomPhotoUrl,
        bridePhoto: bridePhotoUrl,
        events: normalizedEvents,
        theme: theme || 'royal-maroon',
        design: design || 'royal-palace',
        isPaid: false,
        expireAt: oneHourLater,
        blessings: [
          {
            name: 'Family & Well-Wishers',
            status: 'Joyfully Attending',
            wish: `Wishing ${groomName.trim()} & ${brideName.trim()} a lifetime of love and royal togetherness!`
          }
        ]
      });

      res.json({ success: true, cardId: newCard.id, cardUrl: `/card/${newCard.id}` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Preview card banane mein error aaya.' });
    }
  }
);

// 5. API: RAZORPAY ₹29 ORDER CREATE KAREIN
app.post('/api/create-order', async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ error: 'Razorpay keys abhi Render par set nahi hain.' });
    }
    const order = await razorpay.orders.create({
      amount: 2900,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment order create nahi ho paya.' });
  }
});

// 6. API: PAYMENT VERIFY -> UNLOCK -> SEND INVOICE & CARD LINK EMAIL
app.post('/api/unlock-card', async (req, res) => {
  try {
    const { cardId, buyerEmail: formEmail, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed!' });
    }

    let buyerEmail = String(formEmail || '').trim();
    if (!buyerEmail) {
      try {
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        buyerEmail = paymentDetails.email || '';
      } catch (fetchErr) {
        console.error('Razorpay payment fetch warning:', fetchErr.message);
      }
    }

    const fifteenDaysLater = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const card = await Card.findOneAndUpdate(
      { id: cardId },
      {
        isPaid: true,
        paymentId: razorpay_payment_id,
        buyerEmail,
        expireAt: fifteenDaysLater
      },
      { new: true }
    );

    if (!card) return res.status(404).json({ error: 'Card nahi mila.' });

    const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
    const fullCardLink = `${baseUrl}/card/${card.id}`;

    try {
      await sendInvoiceEmail({
        toEmail: buyerEmail,
        card,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        cardLink: fullCardLink
      });
    } catch (mailErr) {
      console.error('Mail send error:', mailErr);
    }

    res.json({ success: true, buyerEmail, cardUrl: `/card/${card.id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Card unlock karne mein error aaya.' });
  }
});// 6. API: PAYMENT VERIFY -> UNLOCK -> SEND INVOICE & CARD LINK EMAIL
app.post('/api/unlock-card', async (req, res) => {
  try {
    const { cardId, buyerEmail: formEmail, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed!' });
    }

    let buyerEmail = String(formEmail || '').trim();
    if (!buyerEmail) {
      try {
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        buyerEmail = paymentDetails.email || '';
      } catch (fetchErr) {
        console.error('Razorpay payment fetch warning:', fetchErr.message);
      }
    }

    const fifteenDaysLater = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const card = await Card.findOneAndUpdate(
      { id: cardId },
      {
        isPaid: true,
        paymentId: razorpay_payment_id,
        buyerEmail,
        expireAt: fifteenDaysLater
      },
      { new: true }
    );

    if (!card) return res.status(404).json({ error: 'Card nahi mila.' });

    const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
    const fullCardLink = `${baseUrl}/card/${card.id}`;

    try {
      await sendInvoiceEmail({
        toEmail: buyerEmail,
        card,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        cardLink: fullCardLink
      });
    } catch (mailErr) {
      console.error('Mail send error:', mailErr);
    }

    res.json({ success: true, buyerEmail, cardUrl: `/card/${card.id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Card unlock karne mein error aaya.' });
  }
});

// 7. API: CARD FETCH KAREIN
app.get('/api/card/:id', async (req, res) => {
  try {
    const card = await Card.findOne({ id: req.params.id });
    if (!card) return res.status(404).json({ error: 'Card expire ho chuka hai ya nahi mila.' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 8. API: BLESSINGS SAVE KAREIN
app.post('/api/card/:id/blessing', async (req, res) => {
  try {
    const { name, status, wish } = req.body;
    const card = await Card.findOne({ id: req.params.id });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    card.blessings.unshift({
      name: String(name).slice(0, 60),
      status: String(status || 'Joyfully Attending').slice(0, 40),
      wish: String(wish || 'Best wishes!').slice(0, 300)
    });
    card.blessings = card.blessings.slice(0, 50);
    await card.save();

    res.json({ success: true, blessings: card.blessings });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 8B. API: EVENTS ADD / EDIT KAREIN (Generated card ke baad bhi)
app.post('/api/card/:id/events', async (req, res) => {
  try {
    const card = await Card.findOne({ id: req.params.id });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    card.events = normalizeEvents(req.body.events);
    await card.save();

    res.json({ success: true, events: card.events });
  } catch (err) {
    res.status(500).json({ error: 'Events update karne mein error aaya.' });
  }
});

// 9. DYNAMIC CARD PAGE ROUTE (Reads public/templates.json automatically)
app.get('/card/:id', async (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  try {
    const card = await Card.findOne({ id: req.params.id });
    const templates = getTemplatesList();
    const matched = card ? templates.find((t) => t.id === card.design) : null;
    const targetFile = matched && matched.file ? matched.file : 'card.html';

    const safePath = path.resolve(publicDir, targetFile);
    if (safePath.startsWith(publicDir) && fs.existsSync(safePath)) {
      return res.sendFile(safePath);
    }
    res.sendFile(path.join(publicDir, 'card.html'));
  } catch (err) {
    res.sendFile(path.join(publicDir, 'card.html'));
  }
});

// 10. PORT BINDING
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
