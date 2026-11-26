(function () {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const cardId = pathParts[pathParts.length - 1];
  if (!cardId || cardId === 'card') return;

  const THEMES = {
    'royal-maroon': {
      bg: '#1c0205',
      bgGradient: 'linear-gradient(180deg, #2b0408 0%, #4a0b16 50%, #1f0205 100%)',
      surface: '#4a0b16',
      surfaceAlt: '#6e1122',
      border: '#d4af37',
      accent: '#f6dc8d',
      lightBg: 'linear-gradient(180deg, #fffdf7 0%, #f3e5c8 100%)',
      lightText: '#4a0b16'
    },
    'peacock-emerald': {
      bg: '#031a18',
      bgGradient: 'linear-gradient(180deg, #042624 0%, #08423e 50%, #031a18 100%)',
      surface: '#073b37',
      surfaceAlt: '#0c544e',
      border: '#d4af37',
      accent: '#99f6e4',
      lightBg: 'linear-gradient(180deg, #f2fbf8 0%, #d5ede6 100%)',
      lightText: '#063733'
    },
    'banarasi-gold': {
      bg: '#1c0e01',
      bgGradient: 'linear-gradient(180deg, #2b1602 0%, #4f2904 50%, #1c0e01 100%)',
      surface: '#4a2504',
      surfaceAlt: '#6b3706',
      border: '#fbbf24',
      accent: '#fde047',
      lightBg: 'linear-gradient(180deg, #fffbeb 0%, #fde68a 100%)',
      lightText: '#451a03'
    }
  };

  function isNativeCard() {
    return document.body && document.body.getAttribute('data-native-card') === 'true';
  }

  function applyUniversalTheme(themeKey) {
    const key = THEMES[themeKey] ? themeKey : 'royal-maroon';
    const t = THEMES[key];

    document.documentElement.setAttribute('data-theme', key);
    document.documentElement.style.setProperty('--theme-bg', t.bg);
    document.documentElement.style.setProperty('--theme-surface', t.surface);
    document.documentElement.style.setProperty('--theme-surface-alt', t.surfaceAlt);
    document.documentElement.style.setProperty('--theme-border', t.border);
    document.documentElement.style.setProperty('--theme-accent', t.accent);

    if (key === 'royal-maroon' || isNativeCard()) return;

    let styleEl = document.getElementById('royal-universal-theme-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'royal-universal-theme-css';
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      body { background: ${t.bg} !important; background-image: ${t.bgGradient} !important; }
      .mahal-viewport, #shahiDarwaza, .scroll-wrapper, .card-container {
        background: ${t.bgGradient} !important; border-color: ${t.border} !important;
      }
      .hero-arch-card, .event-arch, .crest-medallion, .hud-pill, .ctrl-btn, .pill-btn,
      #floatingBar, #actionBar, #rb-action-bar, .game-frame, .game-overlay {
        background: ${t.surface} !important; border-color: ${t.border} !important;
      }
      .palace-door {
        background: linear-gradient(180deg, ${t.surfaceAlt} 0%, ${t.surface} 45%, ${t.bg} 100%) !important;
      }
      .sandstone-card, .cd-box, .parchment-box {
        background: ${t.lightBg} !important; border-color: ${t.border} !important; color: ${t.lightText} !important;
      }
      .sandstone-card h2, .sandstone-card h3, .sandstone-card label, .cd-num { color: ${t.lightText} !important; }
      .sandstone-card button[type="submit"] {
        background: ${t.surface} !important; color: ${t.accent} !important; border-color: ${t.border} !important;
      }
      .gold-foil, .crest-pill p:first-child, .event-arch h3 {
        color: ${t.accent} !important; -webkit-text-fill-color: ${t.accent} !important;
      }
    `;
  }

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
        padding: 10px 12px; display: flex; align-items: center;
        justify-content: space-between; gap: 8px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 -8px 25px rgba(0,0,0,0.75);
      }
      .rb-btn-gold {
        background: linear-gradient(135deg, #f6dc8d, #c99a2e);
        color: #240907; border: none; border-radius: 10px;
        padding: 10px 15px; font-weight: 700; font-size: 12px;
        text-transform: uppercase; letter-spacing: 0.05em;
        cursor: pointer; white-space: nowrap;
      }
      .rb-btn-sub {
        background: #3d0811; color: #f6dc8d;
        border: 1px solid rgba(212,175,55,0.7); border-radius: 10px;
        padding: 8px 10px; font-weight: 700; font-size: 11px;
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
      .rb-overlay-modal {
        position: fixed; inset: 0; z-index: 100010;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(7px);
        display: none; align-items: center; justify-content: center;
        padding: 16px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      }
      .rb-overlay-modal.open { display: flex; }
      .rb-modal-box {
        width: 100%; max-width: 420px; background: #240409;
        border: 1.5px solid rgba(212,175,55,0.75); border-radius: 18px;
        padding: 20px; color: #fffaf0; max-height: 85vh; overflow-y: auto;
        box-shadow: 0 24px 60px rgba(0,0,0,0.9);
      }
      .rb-ev-row {
        display: grid; grid-template-columns: 1.2fr 0.9fr 1fr auto;
        gap: 6px; margin-bottom: 8px; align-items: center;
      }
      .rb-ev-row input, .rb-email-input {
        width: 100%; background: #120204; border: 1px solid rgba(212,175,55,0.45);
        border-radius: 10px; padding: 11px 12px; color: #fff; font-size: 13px;
        outline: none;
      }
      .rb-email-input:focus { border-color: #f6dc8d; }
    `;
    document.head.appendChild(style);
  }

  /* ===== PRE-PAYMENT EMAIL POPUP (Works on ALL 4 Card Templates) ===== */
  function openPrePaymentEmailModal() {
    injectBridgeStyles();
    let modal = document.getElementById('rb-email-pay-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rb-email-pay-modal';
      modal.className = 'rb-overlay-modal';
      modal.innerHTML = `
        <div class="rb-modal-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="color:#f6dc8d;font-size:15px;">📧 Invoice &amp; Card Link Kahan Bhejein?</strong>
            <button type="button" id="rb-mail-close" style="background:none;border:none;color:#f6dc8d;font-size:18px;cursor:pointer;">✕</button>
          </div>
          <p style="font-size:12px;color:rgba(247,238,220,0.85);line-height:1.5;margin:0 0 14px 0;">
            Apna Email ID dalein — payment ke turant baad <strong>₹29 Invoice</strong> aur <strong>Watermark-Free Card Link</strong> isi email par bheja jayega:
          </p>
          <form id="rb-mail-pay-form">
            <input type="email" id="rb-buyer-email-input" class="rb-email-input" required placeholder="e.g. aapka.naam@gmail.com" />
            <div id="rb-mail-err" style="color:#fca5a5;font-size:11px;margin-top:6px;display:none;"></div>
            <button type="submit" id="rb-proceed-rzp-btn" class="rb-btn-gold" style="width:100%;margin-top:14px;padding:12px;">
              Proceed to Pay ₹29 ➔
            </button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('rb-mail-close').onclick = () => modal.classList.remove('open');
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });

      document.getElementById('rb-mail-pay-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const emailInput = document.getElementById('rb-buyer-email-input');
        const errBox = document.getElementById('rb-mail-err');
        const submitBtn = document.getElementById('rb-proceed-rzp-btn');
        const enteredEmail = emailInput.value.trim();

        errBox.style.display = 'none';
        if (!enteredEmail || !enteredEmail.includes('@')) {
          errBox.textContent = 'Kripya sahi Email ID dalein.';
          errBox.style.display = 'block';
          return;
        }

        try { localStorage.setItem('royal_buyer_email', enteredEmail); } catch (_) {}

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Opening Razorpay...';

        try {
          await loadRazorpaySdk();
          const orderRes = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId })
          });
          const order = await orderRes.json();
          if (!orderRes.ok) throw new Error(order.error || 'Order create nahi ho paya.');

          modal.classList.remove('open');

          const cardInfo = window.ROYAL_CARD || {};
          const rzp = new window.Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: 'INR',
            name: 'Royal Wedding Invitations',
            description: 'Unlock Digital Wedding Card (15 Days)',
            order_id: order.orderId,
            prefill: {
              email: enteredEmail,
              contact: cardInfo.whatsappNumber || ''
            },
            handler: async function (response) {
              const vRes = await fetch('/api/unlock-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  cardId,
                  buyerEmail: enteredEmail,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const vData = await vRes.json();
              if (vData.success) {
                const sentTo = vData.buyerEmail || enteredEmail;
                alert(`🎉 Card Unlocked!\nInvoice & permanent card link sent to: ${sentTo}`);
                window.location.reload();
              } else {
                alert(vData.error || 'Payment verification failed');
              }
            },
            theme: { color: '#4a0b16' }
          });
          rzp.open();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
          modal.classList.add('open');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Proceed to Pay ₹29 ➔';
        }
      });
    }

    const inputEl = document.getElementById('rb-buyer-email-input');
    const savedMail = (window.ROYAL_CARD && window.ROYAL_CARD.buyerEmail) || localStorage.getItem('royal_buyer_email') || '';
    if (savedMail && !inputEl.value) inputEl.value = savedMail;
    modal.classList.add('open');
    setTimeout(() => inputEl.focus(), 80);
  }

  // Intercept "Pay ₹29 & Unlock" button click on ALL 4 cards before Razorpay opens
  document.addEventListener('click', function (e) {
    const unlockTrigger = e.target.closest('#unlockRazorpayBtn, #scrollUnlockBtn, #unlockBtn, #rb-pay-btn');
    if (!unlockTrigger) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openPrePaymentEmailModal();
  }, true);

  /* ===== EVENTS EDITOR MODAL ===== */
  function openEventsEditor(card) {
    injectBridgeStyles();
    const targetCard = card || window.ROYAL_CARD || { events: [] };
    let modal = document.getElementById('rb-events-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rb-events-modal';
      modal.className = 'rb-overlay-modal';
      modal.innerHTML = `
        <div class="rb-modal-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <strong style="color:#f6dc8d;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;">Shubh Karyakram — Edit Events</strong>
            <button type="button" id="rb-ev-close" style="background:none;border:none;color:#f6dc8d;font-size:18px;cursor:pointer;">✕</button>
          </div>
          <div id="rb-ev-rows"></div>
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button type="button" id="rb-ev-add" class="rb-btn-sub" style="flex:1;">+ Add Event</button>
            <button type="button" id="rb-ev-save" class="rb-btn-gold" style="flex:1;">Save Events</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('rb-ev-close').onclick = () => modal.classList.remove('open');
      document.getElementById('rb-ev-add').onclick = () => addModalRow({ name: '', time: '', venue: '' });
      document.getElementById('rb-ev-save').onclick = async function () {
        this.disabled = true;
        this.textContent = 'Saving...';
        const list = [];
        document.querySelectorAll('#rb-ev-rows .rb-ev-row').forEach((r) => {
          const inputs = r.querySelectorAll('input');
          const name = inputs[0].value.trim();
          const time = inputs[1].value.trim();
          const venue = inputs[2].value.trim();
          if (name) list.push({ name, time, venue });
        });
        try {
          const res = await fetch(`/api/card/${encodeURIComponent(cardId)}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: list })
          });
          if (res.ok) window.location.reload();
        } catch (e) {
          alert('Save nahi ho paya');
        } finally {
          this.disabled = false;
          this.textContent = 'Save Events';
        }
      };
    }

    const rowsEl = document.getElementById('rb-ev-rows');
    rowsEl.innerHTML = '';
    const existing = Array.isArray(targetCard.events) && targetCard.events.length
      ? targetCard.events
      : [{ name: 'Haldi Ceremony', time: '11:00 AM', venue: 'Royal Courtyard' }];
    existing.forEach(addModalRow);
    modal.classList.add('open');
  }

  function addModalRow(ev) {
    const rowsEl = document.getElementById('rb-ev-rows');
    const row = document.createElement('div');
    row.className = 'rb-ev-row';
    row.innerHTML = `
      <input type="text" placeholder="Event Name" value="${(ev.name || ev.title || '').replace(/"/g, '&quot;')}" />
      <input type="text" placeholder="Time" value="${(ev.time || ev.date || '').replace(/"/g, '&quot;')}" />
      <input type="text" placeholder="Venue" value="${(ev.venue || '').replace(/"/g, '&quot;')}" />
      <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:#f87171;font-weight:bold;cursor:pointer;">✕</button>
    `;
    rowsEl.appendChild(row);
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
    if (isNativeCard()) return;
    injectBridgeStyles();

    if (!card.isPaid) {
      if (!document.getElementById('previewWatermark') && !document.getElementById('rb-watermark')) {
        const wm = document.createElement('div');
        wm.id = 'rb-watermark';
        wm.innerHTML = Array(5)
          .fill('<div class="rb-wm-row">PREVIEW ONLY • PAY ₹29 TO UNLOCK • PREVIEW ONLY • PAY ₹29</div>')
          .join('');
        document.body.appendChild(wm);
      }

      if (!document.getElementById('actionBar') && !document.getElementById('rb-action-bar')) {
        const bar = document.createElement('div');
        bar.id = 'rb-action-bar';
        bar.innerHTML = `
          <div style="min-width:0;">
            <div style="color:#f6dc8d;font-size:10px;font-weight:700;text-transform:uppercase;">1-Hr Preview</div>
            <div style="color:#f7eedc;font-size:9.5px;opacity:0.8;">Unlock 15 days</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button id="rb-edit-ev-btn" class="rb-btn-sub">🪔 Events</button>
            <button id="rb-pay-btn" class="rb-btn-gold">Pay ₹29 & Unlock</button>
          </div>
        `;
        document.body.appendChild(bar);
        document.getElementById('rb-edit-ev-btn').addEventListener('click', () => openEventsEditor(card));
      }
    } else if (!document.getElementById('actionBar') && !document.getElementById('rb-action-bar')) {
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

  window.openRoyalEventsEditor = openEventsEditor;
  window.applyRoyalTheme = applyUniversalTheme;
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
      if (Array.isArray(card.events)) {
        card.events = card.events.map((ev) => ({
          name: ev.name || ev.title || '',
          title: ev.title || ev.name || '',
          time: ev.time || ev.date || '',
          date: ev.date || ev.time || '',
          venue: ev.venue || ''
        }));
      }
      window.ROYAL_CARD = card;
      applyUniversalTheme(card.theme);
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
