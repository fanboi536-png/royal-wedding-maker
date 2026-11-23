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

// 2. RAZORPAY CONFIG (Safe startup agar key abhi na dali ho)
const razorpay = process.env.RAZORPAY_KEY_ID
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

// 3. MONGODB CONNECTION + 15-DAY AUTO DELETE SCHEMA
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
  paymentId: String,
  // 15 din (1296000 seconds) baad MongoDB is card ko apne aap delete kar dega
  createdAt: { type: Date, default: Date.now, expires: 1296000 }
});

const Card = mongoose.model('Card', cardSchema);

// Multer Memory Storage (Disk use nahi hogi, seedha Cloudinary par jayega)
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

// 4. API: RAZORPAY ₹10 ORDER CREATE KAREIN
app.post('/api/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 1000, // 1000 paise = ₹10
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

// 5. API: PAYMENT VERIFY KAREIN AUR CARD BANAYEIN
app.post(
  '/api/create-card',
  upload.fields([
    { name: 'groomPhoto', maxCount: 1 },
    { name: 'bridePhoto', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        groomName,
        groomParents,
        brideName,
        brideParents,
        weddingDate,
        venueName,
        venueAddress,
        whatsappNumber,
        eventsJson
      } = req.body;

      // Payment Signature Verify Karein (Security Check)
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSig !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment verification failed!' });
      }

      // Photos Cloudinary par upload karein
      let groomPhotoUrl = '';
      let bridePhotoUrl = '';
      if (req.files['groomPhoto']) {
        groomPhotoUrl = await uploadToCloudinary(req.files['groomPhoto'][0].buffer);
      }
      if (req.files['bridePhoto']) {
        bridePhotoUrl = await uploadToCloudinary(req.files['bridePhoto'][0].buffer);
      }

      const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'royal';
      const cardId = `${clean(groomName)}-weds-${clean(brideName)}-${crypto.randomBytes(3).toString('hex')}`;

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
        paymentId: razorpay_payment_id,
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
      res.status(500).json({ error: 'Card banane mein error aaya.' });
    }
  }
);

// 6. API: CARD FETCH KAREIN
app.get('/api/card/:id', async (req, res) => {
  try {
    const card = await Card.findOne({ id: req.params.id });
    if (!card) return res.status(404).json({ error: 'Card expire ho chuka hai ya nahi mila.' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 7. API: BLESSINGS SAVE KAREIN
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

app.get('/card/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'card.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

