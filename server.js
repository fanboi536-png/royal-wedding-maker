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

// 3. MONGODB CONNECTION + SMART AUTO-DELETE (1 Hr Unpaid / 15 Days Paid)
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
