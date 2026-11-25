const express = require('express');
const multer = require('multer');
const path = require('path');
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
        events: JSON.parse(eventsJson || '[]'),
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
      amount: 2900, // 2900 paise = ₹29
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

// 6. API: PAYMENT VERIFY KAREIN -> UNLOCK FOR 15 DAYS
app.post('/api/unlock-card', async (req, res) => {
  try {
    const { cardId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed!' });
    }

    const fifteenDaysLater = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const card = await Card.findOneAndUpdate(
      { id: cardId },
      {
        isPaid: true,
        paymentId: razorpay_payment_id,
        expireAt: fifteenDaysLater
      },
      { new: true }
    );

    if (!card) return res.status(404).json({ error: 'Card nahi mila.' });

    res.json({ success: true, cardUrl: `/card/${card.id}` });
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

// 9. CARD PAGE ROUTE (Shahi Scroll vs Royal Card)
app.get('/card/:id', async (req, res) => {
  try {
    const card = await Card.findOne({ id: req.params.id });
    if (card && card.design === 'shahi-scroll') {
      return res.sendFile(path.join(__dirname, 'public', 'scroll-card.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'card.html'));
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'card.html'));
  }
});

// 10. PORT BINDING
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
