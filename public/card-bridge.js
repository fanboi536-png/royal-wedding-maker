(function () {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const cardId = pathParts[pathParts.length - 1];
  if (!cardId || cardId === 'card') return;

  function loadRazorpaySdk() {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  function injectBridgeStyles() {
    if (document.getElementById('royal-bridge-css')) return;
    const style = document.createElement('style');
    style.id = 'royal-bridge-css';
    style.textContent = `
      #rb-watermark {
        position: fixed; inset: 0; z-index: 99990; pointer-events: none;
        overflow: hidden; display: flex; flex-direction: column;
        justify-content: space-around; opacity: 0.22;
      }
      .rb-wm-row {
        white-space: nowrap; font-family: system-ui, sans-serif;
        font-weight: 800; font-size: 15px; letter-spacing: 0.26em;
        color: #f6dc8d; transform: rotate(-24deg);
        text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      }
      #rb-action-bar {
        position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
        width: 100%; max-width: 480px; z-index: 99999;
        background: rgba(15, 6, 8, 0.95); backdrop-filter: blur(10px);
        border-top: 1px solid rgba(212, 175, 55, 0.65);
        padding: 10px 14px; display: flex; align-items: center;
        justify-content: space-between; gap: 10px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 -8px 25px rgba(0,0,0,0.75);
      }
      .rb-btn-gold {
        background: linear-gradient(135deg, #f6dc8d, #c99a2e);
        color: #240907; border: none; border-radius: 10px;
        padding: 10px 16px; font-weight: 700; font-size: 12px;
        text-transform: uppercase; letter-spacing: 0.06em;
        cursor: pointer; white-space: nowrap;
      }
      .rb-btn-wa {
        flex: 1; background: #15803d; color: #fff; border: none;
        border-radius: 10px; padding: 10px 14px; font-weight: 700;
        font-size: 12px; text-transform: uppercase; cursor: pointer;
      }
      .rb-btn-copy {
        background: #4a0b16; color: #f6dc8d;
        border: 1px solid #d4af37; border-radius: 10px;
        padding: 10px 14px; font-weight: 700; font-size: 12px; cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function autoBindFields(card) {
    const formattedDate = card.weddingDate
      ? new Date(card.weddingDate).toLocaleDateString('en-IN', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : '';

    const map = {
      groomName: card.groomName || '',
      brideName: card.brideName || '',
      groomParents: card.groomParents || '',
      brideParents: card.brideParents || '',
      venueName: card.venueName || '',
      venueAddress: card.venueAddress || '',
      displayDate: formattedDate,
      weddingDate: card.weddingDate || ''
    };

    document.querySelectorAll('[data-bind]').forEach((el) => {
      const key = el.getAttribute('data-bind');
      if (map[key] !== undefined) el.textContent = map[key];
    });

    if (card.groomPhoto) {
      document.querySelectorAll('[data-bind-photo="groom"]').forEach((img) => {
        img.src = card.groomPhoto;
        img.style.display = 'block';
      });
    }
    if (card.bridePhoto) {
      document.querySelectorAll('[data-bind-photo="bride"]').forEach((img) => {
        img.src = card.bridePhoto;
        img.style.display = 'block';
      });
    }
  }

  function renderBars(card) {
    injectBridgeStyles();

    if (!card.isPaid) {
      const wm = document.createElement('div');
      wm.id = 'rb-watermark';
      wm.innerHTML = Array(5)
        .fill('<div class="rb-wm-row">PREVIEW ONLY • PAY ₹29 TO UNLOCK • PREVIEW ONLY • PAY ₹29</div>')
        .join('');
      document.body.appendChild(wm);

      const bar = document.createElement('div');
      bar.id = 'rb-action-bar';
      bar.innerHTML = `
        <div>
          <div style="color:#f6dc8d;font-size:11px;font-weight:700;text-transform:uppercase;">1-Hour Free Preview</div>
          <div style="color:#f7eedc;font-size:10px;opacity:0.8;">Remove watermark & keep for 15 days</div>
        </div>
        <button id="rb-pay-btn" class="rb-btn-gold">Pay ₹29 & Unlock</button>
      `;
      document.body.appendChild(bar);

      document.getElementById('rb-pay-btn').addEventListener('click', async function () {
        const btn = this;
        btn.disabled = true;
        btn.textContent = 'Processing...';
        try {
          await loadRazorpaySdk();
          const res = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId })
          });
          const order = await res.json();
          if (!res.ok) throw new Error(order.error || 'Order failed');

          const rzp = new window.Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: 'INR',
            name: 'Royal Wedding Invitations',
            description: 'Unlock Digital Wedding Card (15 Days)',
            order_id: order.orderId,
            handler: async function (response) {
              const vRes = await fetch('/api/unlock-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  cardId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const vData = await vRes.json();
              if (vData.success) {
                alert('🎉 Card Unlocked! Invoice & link sent to your email.');
                window.location.reload();
              } else {
                alert(vData.error || 'Verification failed');
              }
            },
            theme: { color: '#4a0b16' }
          });
          rzp.open();
        } catch (err) {
          alert(err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Pay ₹29 & Unlock';
        }
      });
    } else {
      const bar = document.createElement('div');
      bar.id = 'rb-action-bar';
      bar.innerHTML = `
        <button id="rb-wa-btn" class="rb-btn-wa">💬 Share on WhatsApp</button>
        <button id="rb-copy-btn" class="rb-btn-copy">🔗 Copy Link</button>
      `;
      document.body.appendChild(bar);

      document.getElementById('rb-wa-btn').addEventListener('click', () => {
        const msg = `👑 *Shahi Nimantran* 👑\nYou are cordially invited to the wedding of *${card.groomName} & ${card.brideName}*.\nOpen your royal invitation:\n${window.location.href}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      });

      document.getElementById('rb-copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        const b = document.getElementById('rb-copy-btn');
        b.textContent = '✅ Copied!';
        setTimeout(() => (b.textContent = '🔗 Copy Link'), 2000);
      });
    }
  }

  window.saveRoyalBlessing = async function (name, status, wish) {
    const res = await fetch(`/api/card/${encodeURIComponent(cardId)}/blessing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, status, wish })
    });
    return res.json();
  };

  async function initBridge() {
    try {
      const res = await fetch(`/api/card/${encodeURIComponent(cardId)}`);
      if (!res.ok) return;
      const card = await res.json();
      window.ROYAL_CARD = card;
      autoBindFields(card);
      renderBars(card);
      window.dispatchEvent(new CustomEvent('royalCardReady', { detail: card }));
    } catch (e) {
      console.error('Card bridge error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBridge);
  } else {
    initBridge();
  }
})();
