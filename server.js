const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Zaroori folders auto-create karein
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// -------------------------------------------------------------
// 1. MULTER SETUP (Image Upload - Max 3MB per photo)
// -------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB max per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sirf image files allowed hain!'));
  }
});

// -------------------------------------------------------------
// 2. API: NAYA WEDDING CARD CREATE KAREIN
// -------------------------------------------------------------
app.post(
  '/api/create-card',
  upload.fields([
    { name: 'groomPhoto', maxCount: 1 },
    { name: 'bridePhoto', maxCount: 1 }
  ]),
  (req, res) => {
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
        eventsJson
      } = req.body;

      if (!groomName || !brideName || !weddingDate) {
        return res.status(400).json({ error: 'Groom, Bride aur Wedding Date zaroori hai.' });
      }

      // Unique readable slug: e.g. rahul-weds-kanika-a4f91c
      const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'royal';
      const cardId = `${clean(groomName)}-weds-${clean(brideName)}-${crypto.randomBytes(3).toString('hex')}`;

      const groomFile = req.files['groomPhoto'] ? req.files['groomPhoto'][0].filename : null;
      const brideFile = req.files['bridePhoto'] ? req.files['bridePhoto'][0].filename : null;

      let events = [];
      try {
        events = JSON.parse(eventsJson || '[]');
      } catch (e) {
        events = [];
      }

      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const cardData = {
        id: cardId,
        groomName: groomName.trim(),
        groomParents: groomParents?.trim() || '',
        brideName: brideName.trim(),
        brideParents: brideParents?.trim() || '',
        weddingDate,
        venueName: venueName?.trim() || 'Royal Palace',
        venueAddress: venueAddress?.trim() || '',
        whatsappNumber: (whatsappNumber || '').replace(/\D/g, ''),
        groomPhoto: groomFile ? `/uploads/${groomFile}` : '',
        bridePhoto: brideFile ? `/uploads/${brideFile}` : '',
        groomFileName: groomFile,
        brideFileName: brideFile,
        events,
        blessings: [
          {
            name: 'Family & Well-Wishers',
            status: 'Joyfully Attending',
            wish: `Wishing ${groomName.trim()} & ${brideName.trim()} a lifetime of love, happiness, and royal togetherness!`
          }
        ],
        createdAt: now,
        expiresAt: now + FIFTEEN_DAYS_MS
      };

      fs.writeFileSync(path.join(DATA_DIR, `${cardId}.json`), JSON.stringify(cardData, null, 2));

      res.json({
        success: true,
        cardId,
        cardUrl: `/card/${cardId}`,
        expiresAt: cardData.expiresAt
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Card create karne mein error aaya.' });
    }
  }
);

// -------------------------------------------------------------
// 3. API: CARD DATA FETCH KAREIN
// -------------------------------------------------------------
app.get('/api/card/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card nahi mila ya 15 din baad expire ho chuka hai.' });
  }

  const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Extra check: Agar 15 din poore ho gaye hon toh turant delete kar dein
  if (Date.now() > card.expiresAt) {
    deleteCardFiles(card, filePath);
    return res.status(410).json({ error: 'Ye invitation link 15 din baad expire ho chuka hai.' });
  }

  res.json(card);
});

// -------------------------------------------------------------
// 4. API: GUEST BLESSINGS SAVE KAREIN (Server par)
// -------------------------------------------------------------
app.post('/api/card/:id/blessing', (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const { name, status, wish } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  card.blessings.unshift({
    name: String(name).slice(0, 60),
    status: String(status || 'Joyfully Attending').slice(0, 40),
    wish: String(wish || 'Best wishes!').slice(0, 300)
  });

  // Max 50 blessings rakhein taaki file badi na ho
  card.blessings = card.blessings.slice(0, 50);

  fs.writeFileSync(filePath, JSON.stringify(card, null, 2));
  res.json({ success: true, blessings: card.blessings });
});

// -------------------------------------------------------------
// 5. CARD VIEW PAGE ROUTE
// -------------------------------------------------------------
app.get('/card/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'card.html'));
});

// -------------------------------------------------------------
// 6. AUTO-DELETE LOGIC (15 DIN PURANE CARDS & PHOTOS DELETE)
// -------------------------------------------------------------
function deleteCardFiles(card, jsonPath) {
  try {
    if (card.groomFileName) {
      const gPath = path.join(UPLOAD_DIR, card.groomFileName);
      if (fs.existsSync(gPath)) fs.unlinkSync(gPath);
    }
    if (card.brideFileName) {
      const bPath = path.join(UPLOAD_DIR, card.brideFileName);
      if (fs.existsSync(bPath)) fs.unlinkSync(bPath);
    }
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    console.log(`🗑️ Deleted expired card: ${card.id}`);
  } catch (err) {
    console.error('Delete error:', err);
  }
}

function cleanupExpiredCards() {
  const files = fs.readdirSync(DATA_DIR);
  const now = Date.now();
  files.forEach((file) => {
    if (!file.endsWith('.json')) return;
    const filePath = path.join(DATA_DIR, file);
    try {
      const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (now > card.expiresAt) {
        deleteCardFiles(card, filePath);
      }
    } catch (e) {}
  });
}

// Har 6 ghante mein automatic cleanup chalega + server start hone par bhi
cron.schedule('0 */6 * * *', cleanupExpiredCards);
cleanupExpiredCards();

app.listen(PORT, () => {
  console.log(`🚀 Royal Wedding Maker running at http://localhost:${PORT}`);
});