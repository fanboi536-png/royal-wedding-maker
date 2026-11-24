res.json({ success: true, cardId: newCard.id, cardUrl: `/card/${newCard.id}` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Preview card banane mein error aaya.' });
    }
  }
);

// 5. API: RAZORPAY ₹10 ORDER CREATE KAREIN
app.post('/api/create-order', async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ error: 'Razorpay keys abhi Render par set nahi hain.' });
    }
    const order = await razorpay.orders.create({
      amount: 1000,
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
