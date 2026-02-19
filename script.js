const STORAGE_KEY = 'bros-matcha-app-v1';

const drinks = [
  { name: 'Kicker', type: 'Coffee', price: 5.45 },
  { name: 'Golden Eagle', type: 'Coffee', price: 5.95 },
  { name: 'Caramelizer', type: 'Coffee', price: 5.85 },
  { name: 'Matcha Latte', type: 'Matcha', price: 6.15 },
  { name: 'Strawberry Matcha', type: 'Matcha', price: 6.35 },
  { name: 'Nitro Cold Brew', type: 'Coffee', price: 5.55 },
];

const locations = [
  { name: 'Bros Stand · Downtown', miles: 0.8, open: true, wait: '5 min' },
  { name: 'Bros Stand · Hawthorne', miles: 1.6, open: true, wait: '9 min' },
  { name: 'Bros Stand · Lloyd', miles: 2.3, open: false, wait: 'Closed' },
  { name: 'Bros Stand · Pearl', miles: 2.9, open: true, wait: '4 min' },
];

const challenges = [
  { text: 'Buy 3 medium drinks this week', progress: '2 / 3' },
  { text: 'Try any matcha specialty', progress: '0 / 1' },
  { text: 'Share 2 drink codes with friends', progress: '1 / 2' },
];

const state = {
  selectedDrink: drinks[0].name,
  selectedSize: 'Small',
  cart: [],
  friends: ['@broista_ben', '@matchamaya'],
  feed: [],
  orderHistory: [],
  code: '',
  onlyOpen: false,
  points: 1820,
  streak: 12,
  myHandle: `@bros_${Math.random().toString(36).slice(2, 6)}`,
  scannerStream: null,
  scanTimer: null,
};

const el = {
  menuGrid: document.getElementById('menuGrid'),
  drinkSelect: document.getElementById('drinkSelect'),
  sizeRow: document.getElementById('sizeRow'),
  builderForm: document.getElementById('builderForm'),
  currentDrink: document.getElementById('currentDrink'),
  drinkCode: document.getElementById('drinkCode'),
  prepTime: document.getElementById('prepTime'),
  cartList: document.getElementById('cartList'),
  cartTotal: document.getElementById('cartTotal'),
  orderHistoryList: document.getElementById('orderHistoryList'),
  locationList: document.getElementById('locationList'),
  friendList: document.getElementById('friendList'),
  feedList: document.getElementById('feedList'),
  challengeList: document.getElementById('challengeList'),
  checkoutDialog: document.getElementById('checkoutDialog'),
  checkoutMessage: document.getElementById('checkoutMessage'),
  friendQrCanvas: document.getElementById('friendQrCanvas'),
  drinkQrCanvas: document.getElementById('drinkQrCanvas'),
  friendPayload: document.getElementById('friendPayload'),
  drinkPayload: document.getElementById('drinkPayload'),
  qrScanStatus: document.getElementById('qrScanStatus'),
  qrVideo: document.getElementById('qrVideo'),
  qrUploadInput: document.getElementById('qrUploadInput'),
  pointsLabel: document.getElementById('pointsLabel'),
  tierProgress: document.getElementById('tierProgress'),
  streakLabel: document.getElementById('streakLabel'),
};

function saveState() {
  const persistable = {
    friends: state.friends,
    feed: state.feed,
    orderHistory: state.orderHistory,
    points: state.points,
    streak: state.streak,
    myHandle: state.myHandle,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.friends)) state.friends = data.friends;
    if (Array.isArray(data.feed)) state.feed = data.feed;
    if (Array.isArray(data.orderHistory)) state.orderHistory = data.orderHistory;
    if (Number.isFinite(data.points)) state.points = data.points;
    if (Number.isFinite(data.streak)) state.streak = data.streak;
    if (typeof data.myHandle === 'string' && data.myHandle.startsWith('@')) state.myHandle = data.myHandle;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function selectedAddons() {
  return [...document.querySelectorAll('#addonsRow input:checked')].map((x) => x.value);
}

function nowStamp() {
  return new Date().toLocaleString();
}

function renderMenu() {
  el.menuGrid.innerHTML = drinks
    .map((drink) => {
      const active = drink.name === state.selectedDrink ? 'active' : '';
      return `<button class="menu-item ${active}" data-drink="${drink.name}"><strong>${drink.name}</strong><br/><small>${drink.type} · $${drink.price.toFixed(2)}</small></button>`;
    })
    .join('');

  el.drinkSelect.innerHTML = drinks
    .map((drink) => `<option ${drink.name === state.selectedDrink ? 'selected' : ''}>${drink.name}</option>`)
    .join('');
}

function renderChallenges() {
  el.challengeList.innerHTML = challenges
    .map((c) => `<li><strong>${c.text}</strong><br/><span class="meta">Progress: ${c.progress}</span></li>`)
    .join('');
}

function syncCurrentDrink() {
  const milk = document.getElementById('milkSelect').value;
  const addons = selectedAddons();
  const notes = document.getElementById('notesInput').value.trim();
  const addonText = addons.length ? ` · Add-ons: ${addons.join(', ')}` : '';
  const noteText = notes ? ` · Note: ${notes}` : '';

  el.currentDrink.textContent = `${state.selectedSize} ${state.selectedDrink} · ${milk}${addonText}${noteText}`;
  el.prepTime.textContent = `${6 + addons.length * 2}–${10 + addons.length * 2} min`;
}

function makeCode() {
  const base = `${state.selectedDrink}-${state.selectedSize}`.replace(/\s+/g, '').toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BRO-${base.slice(0, 10)}-${suffix}`;
}

function drinkPrice() {
  const drink = drinks.find((d) => d.name === state.selectedDrink);
  const sizeUpcharge = state.selectedSize === 'Medium' ? 0.5 : state.selectedSize === 'Large' ? 1 : 0;
  const addonsCost = selectedAddons().length * 0.75;
  return Number((drink.price + sizeUpcharge + addonsCost).toFixed(2));
}

function renderCart() {
  if (!state.cart.length) {
    el.cartList.innerHTML = '<li>Your cart is empty.</li>';
    el.cartTotal.textContent = '$0.00';
    return;
  }

  el.cartList.innerHTML = state.cart
    .map((item) => `<li><strong>${item.name}</strong><br/><span>${item.config}</span><br/><strong>$${item.price.toFixed(2)}</strong></li>`)
    .join('');

  const total = state.cart.reduce((sum, item) => sum + item.price, 0);
  el.cartTotal.textContent = `$${total.toFixed(2)}`;
}

function renderOrderHistory() {
  if (!state.orderHistory.length) {
    el.orderHistoryList.innerHTML = '<li>No completed orders yet.</li>';
    return;
  }
  el.orderHistoryList.innerHTML = state.orderHistory
    .slice(0, 8)
    .map((order) => `<li><strong>${order.items} item(s)</strong> · $${order.total.toFixed(2)}<br/><span class="meta">${order.time}</span></li>`)
    .join('');
}

function renderLocations(seed = 1) {
  const zipBoost = (seed % 4) * 0.1;
  const items = locations
    .map((loc, idx) => ({ ...loc, miles: (loc.miles + zipBoost + idx * 0.05).toFixed(1) }))
    .filter((loc) => (state.onlyOpen ? loc.open : true));

  el.locationList.innerHTML = items
    .map((loc) => `<li><strong>${loc.name}</strong><br/><span>${loc.miles} miles · ${loc.open ? 'Open' : 'Closed'} · Wait ${loc.wait}</span></li>`)
    .join('');
}

function renderFriends() {
  el.friendList.innerHTML = state.friends.map((f) => `<li>${f}</li>`).join('');
}

function renderFeed() {
  if (!state.feed.length) {
    el.feedList.innerHTML = '<li>No social activity yet. Share a code to start.</li>';
    return;
  }
  el.feedList.innerHTML = state.feed
    .slice(0, 15)
    .map((entry) => `<li>${entry.text}<br/><span class="meta">${entry.time}</span></li>`)
    .join('');
}

function renderRewards() {
  el.pointsLabel.textContent = String(state.points);
  el.streakLabel.textContent = `${state.streak}-day streak`;
  el.tierProgress.value = Math.min(state.points, Number(el.tierProgress.max));
}

function pushFeed(text) {
  state.feed.unshift({ text, time: nowStamp() });
  saveState();
  renderFeed();
}

function buildPayload(type, data) {
  const params = new URLSearchParams(data);
  return `BROS://${type}?${params.toString()}`;
}

function drawQr(container, payload) {
  container.innerHTML = '';
  if (window.QRCode) {
    new QRCode(container, { text: payload, width: 160, height: 160 });
  } else {
    const img = document.createElement('img');
    img.alt = 'QR code';
    img.src = `https://quickchart.io/qr?size=220&text=${encodeURIComponent(payload)}`;
    container.append(img);
  }
}

function refreshFriendQr() {
  const payload = buildPayload('FRIEND', { user: state.myHandle });
  drawQr(el.friendQrCanvas, payload);
  el.friendPayload.textContent = payload;
}

function refreshDrinkQr() {
  if (!state.code) {
    state.code = makeCode();
    el.drinkCode.textContent = `Share code: ${state.code}`;
  }
  const payload = buildPayload('DRINK', { code: state.code, drink: state.selectedDrink });
  drawQr(el.drinkQrCanvas, payload);
  el.drinkPayload.textContent = payload;
}

function parsePayload(rawValue) {
  if (!rawValue || !rawValue.startsWith('BROS://')) return null;
  const normalized = rawValue.replace('BROS://', 'https://');
  const parsed = new URL(normalized);
  return { type: parsed.hostname.toUpperCase(), params: parsed.searchParams };
}

function handleScannedPayload(rawValue) {
  const payload = parsePayload(rawValue);
  if (!payload) {
    el.qrScanStatus.textContent = 'Unsupported QR payload.';
    return;
  }

  if (payload.type === 'FRIEND') {
    const user = payload.params.get('user');
    if (!user) return;
    if (!state.friends.includes(user)) {
      state.friends.push(user);
      saveState();
      renderFriends();
    }
    el.qrScanStatus.textContent = `Friend added from QR: ${user}`;
    return;
  }

  if (payload.type === 'DRINK') {
    const code = payload.params.get('code');
    const drink = payload.params.get('drink') || 'shared drink';
    if (!code) return;
    state.points += 25;
    pushFeed(`<strong>QR Redeemed:</strong> <code>${code}</code> · ${drink} · +25 points`);
    renderRewards();
    saveState();
    el.qrScanStatus.textContent = `Drink redeemed from QR: ${code}`;
  }
}

async function scanFrameWithBarcodeDetector(source) {
  if (!('BarcodeDetector' in window)) return null;
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  const barcodes = await detector.detect(source);
  return barcodes[0]?.rawValue || null;
}

async function startQrScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    el.qrScanStatus.textContent = 'Camera scan unavailable in this browser.';
    return;
  }
  try {
    state.scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    el.qrVideo.srcObject = state.scannerStream;
    el.qrVideo.classList.remove('hidden');
    el.qrScanStatus.textContent = 'Scanner running. Point camera at a QR code.';
    state.scanTimer = setInterval(async () => {
      try {
        const value = await scanFrameWithBarcodeDetector(el.qrVideo);
        if (value) handleScannedPayload(value);
      } catch {
        // ignore per-cycle scan errors
      }
    }, 900);
  } catch {
    el.qrScanStatus.textContent = 'Unable to access camera.';
  }
}

function stopQrScanner() {
  if (state.scanTimer) {
    clearInterval(state.scanTimer);
    state.scanTimer = null;
  }
  if (state.scannerStream) {
    state.scannerStream.getTracks().forEach((track) => track.stop());
    state.scannerStream = null;
  }
  el.qrVideo.srcObject = null;
  el.qrVideo.classList.add('hidden');
}

async function scanUploadedQr(file) {
  if (!file) return;
  if (!('createImageBitmap' in window)) {
    el.qrScanStatus.textContent = 'Image scan unsupported in this browser.';
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const value = await scanFrameWithBarcodeDetector(bitmap);
    if (value) {
      handleScannedPayload(value);
    } else {
      el.qrScanStatus.textContent = 'No QR code detected in image.';
    }
  } catch {
    el.qrScanStatus.textContent = 'Could not scan uploaded image.';
  }
}

function init() {
  loadState();
  renderMenu();
  renderChallenges();
  renderLocations();
  renderFriends();
  renderFeed();
  renderOrderHistory();
  renderRewards();
  syncCurrentDrink();
  refreshFriendQr();
  refreshDrinkQr();

  el.menuGrid.addEventListener('click', (event) => {
    const target = event.target.closest('[data-drink]');
    if (!target) return;
    state.selectedDrink = target.dataset.drink;
    renderMenu();
    syncCurrentDrink();
    refreshDrinkQr();
  });

  el.drinkSelect.addEventListener('change', () => {
    state.selectedDrink = el.drinkSelect.value;
    renderMenu();
    syncCurrentDrink();
    refreshDrinkQr();
  });

  el.sizeRow.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      el.sizeRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.selectedSize = chip.dataset.size;
      syncCurrentDrink();
      refreshDrinkQr();
    });
  });

  document.getElementById('milkSelect').addEventListener('change', syncCurrentDrink);
  document.getElementById('notesInput').addEventListener('input', syncCurrentDrink);
  document.querySelectorAll('#addonsRow input').forEach((check) => check.addEventListener('change', syncCurrentDrink));

  el.builderForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const item = {
      name: `${state.selectedSize} ${state.selectedDrink}`,
      config: el.currentDrink.textContent,
      price: drinkPrice(),
    };
    state.cart.push(item);
    renderCart();
  });

  document.getElementById('saveCodeBtn').addEventListener('click', () => {
    state.code = makeCode();
    el.drinkCode.textContent = `Share code: ${state.code}`;
    refreshDrinkQr();
  });

  document.getElementById('shareCodeBtn').addEventListener('click', () => {
    if (!state.code) {
      el.qrScanStatus.textContent = 'Generate a drink share code first.';
      return;
    }
    pushFeed(`<strong>You shared</strong> <code>${state.code}</code> · ${state.selectedDrink}`);
  });

  document.getElementById('redeemBtn').addEventListener('click', () => {
    const redeemInput = document.getElementById('redeemInput');
    const value = redeemInput.value.trim();
    if (!value) return;
    state.points += 25;
    pushFeed(`<strong>Redeemed:</strong> <code>${value}</code> · +25 points`);
    renderRewards();
    saveState();
    redeemInput.value = '';
  });

  document.getElementById('addFriendBtn').addEventListener('click', () => {
    const input = document.getElementById('friendInput');
    const value = input.value.trim();
    if (!value) return;
    const user = value.startsWith('@') ? value : `@${value}`;
    if (!state.friends.includes(user)) {
      state.friends.push(user);
      saveState();
      renderFriends();
    }
    input.value = '';
  });

  document.getElementById('refreshFriendQrBtn').addEventListener('click', () => {
    state.myHandle = `@bros_${Math.random().toString(36).slice(2, 6)}`;
    refreshFriendQr();
    saveState();
  });

  document.getElementById('refreshDrinkQrBtn').addEventListener('click', () => {
    state.code = makeCode();
    el.drinkCode.textContent = `Share code: ${state.code}`;
    refreshDrinkQr();
  });

  document.getElementById('startScanBtn').addEventListener('click', startQrScanner);
  document.getElementById('stopScanBtn').addEventListener('click', () => {
    stopQrScanner();
    el.qrScanStatus.textContent = 'Scanner stopped.';
  });

  el.qrUploadInput.addEventListener('change', () => {
    scanUploadedQr(el.qrUploadInput.files[0]);
    el.qrUploadInput.value = '';
  });

  document.getElementById('zipBtn').addEventListener('click', () => {
    const zip = document.getElementById('zipInput').value.trim();
    const seed = Number.parseInt(zip.slice(-2), 10) || 1;
    renderLocations(seed);
  });

  document.getElementById('openNowBtn').addEventListener('click', () => {
    state.onlyOpen = !state.onlyOpen;
    document.getElementById('openNowBtn').textContent = state.onlyOpen ? 'Showing Open Now' : 'Open Now';
    renderLocations(2);
  });

  document.getElementById('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      renderLocations(3);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const seed = Math.abs(Math.round(position.coords.latitude + position.coords.longitude));
        renderLocations(seed);
      },
      () => renderLocations(4),
    );
  });

  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (!state.cart.length) {
      el.checkoutMessage.textContent = 'Add at least one drink to your cart.';
      el.checkoutDialog.showModal();
      return;
    }

    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    const pointsEarned = Math.round(total * 10);
    state.points += pointsEarned;
    state.orderHistory.unshift({ items: state.cart.length, total, time: nowStamp() });
    state.streak += 1;
    state.cart = [];

    el.checkoutMessage.textContent = `Order confirmed. Earned ${pointsEarned} points.`;
    renderCart();
    renderOrderHistory();
    renderRewards();
    saveState();
    el.checkoutDialog.showModal();
  });

  document.getElementById('closeDialogBtn').addEventListener('click', () => el.checkoutDialog.close());
  document.getElementById('jumpOrderBtn').addEventListener('click', () => document.getElementById('orderingPanel').scrollIntoView({ behavior: 'smooth' }));
  document.getElementById('jumpRewardsBtn').addEventListener('click', () => document.getElementById('rewardsPanel').scrollIntoView({ behavior: 'smooth' }));

  window.addEventListener('beforeunload', stopQrScanner);
}

init();
renderCart();
