const RSVP_PARENT = '5186103096';
const RSVP_ZAYNE = '2074407812';
const API = '/api/rsvp';
const LOCAL_KEY = 'zayne-range-pond-rsvps';
const SUBMITTED_KEY = 'zayne-range-pond-rsvp-submitted';

const cube = document.getElementById('party-cube');
const unfold = document.getElementById('unfold-card');
const partyBurst = document.getElementById('party-burst');
const countEl = document.getElementById('going-count');
const goingLabel = document.getElementById('going-label');
const listEl = document.getElementById('rsvp-list');
const form = document.getElementById('rsvp-form');
const statusEl = document.getElementById('form-status');
const parentSms = document.getElementById('parent-sms');
const zayneSms = document.getElementById('zayne-sms');
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');

let confetti = [];
let lastKnownCount = 0;
let partyBurstShown = false;

function normalizeName(name) {
  return String(name || '').replace(/[<>]/g, '').trim().slice(0, 80);
}

function setSmsLinks(payload = {}) {
  const name = normalizeName(payload.name) || 'Friend';
  const status = payload.status === 'not-going' ? "can't make it" : 'is going';
  const message = encodeURIComponent(`Zayne birthday RSVP: ${name} ${status}. Please have your parent RSVP Zaynes Dad.`);
  parentSms.href = `sms:${RSVP_PARENT}?&body=${message}`;
  zayneSms.href = `sms:${RSVP_ZAYNE}?&body=${message}`;
}

function localRsvps() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch { return []; }
}

function saveLocal(payload) {
  const list = localRsvps();
  const existingIndex = list.findIndex(item => item.clientId && item.clientId === payload.clientId);
  const cleaned = { ...payload, at: new Date().toISOString() };
  if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...cleaned };
  else list.push(cleaned);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  localStorage.setItem(SUBMITTED_KEY, JSON.stringify({ clientId: payload.clientId, name: payload.name, at: cleaned.at }));
  return list;
}

function localGoingCount() {
  return localRsvps().filter(r => r.status === 'going').length;
}

function renderBoard(list = []) {
  const going = list.filter(item => item.status === 'going');
  lastKnownCount = going.length;
  countEl.textContent = String(lastKnownCount);
  goingLabel.textContent = lastKnownCount === 1 ? 'person is going' : 'people are going';
  listEl.innerHTML = '';
  if (!going.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No RSVPs yet — be the first on the board.';
    listEl.appendChild(empty);
    return;
  }
  for (const item of going.slice(-10).reverse()) {
    const li = document.createElement('li');
    li.textContent = `${item.name} is going`;
    listEl.appendChild(li);
  }
}

function submittedAlready() {
  try { return JSON.parse(localStorage.getItem(SUBMITTED_KEY) || 'null'); }
  catch { return null; }
}

function lockFormIfSubmitted() {
  const submitted = submittedAlready();
  if (!submitted) return;
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  statusEl.textContent = `${submitted.name || 'You'} already RSVP'd from this device, so duplicate submits are blocked.`;
}

async function refreshCount() {
  try {
    const res = await fetch(API, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    renderBoard(Array.isArray(data.rsvps) ? data.rsvps : []);
  } catch {
    renderBoard(localRsvps());
  }
}

async function submitRsvp(payload) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `API ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('duplicate')) throw err;
    const list = saveLocal(payload);
    return { ok: true, mode: 'local-demo', goingCount: localGoingCount(), rsvps: list };
  }
}

function updateScrollMotion() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max ? scrollY / max : 0;
  const cubeSpin = p * 420;
  const cubeTilt = Math.sin(p * Math.PI * 2) * 18;
  const cubeRoll = Math.cos(p * Math.PI * 1.5) * 10;
  cube.style.transform = `rotateX(${cubeTilt - cubeSpin * 0.14}deg) rotateY(${cubeSpin}deg) rotateZ(${cubeRoll}deg)`;

  const rect = unfold.getBoundingClientRect();
  const visibleRaw = (innerHeight - rect.top) / (innerHeight * 0.95);
  const visible = Math.min(1, Math.max(0, (visibleRaw - 0.32) / 0.68));
  const left = unfold.querySelector('.flap-left');
  const right = unfold.querySelector('.flap-right');
  const cake = unfold.querySelector('.flap-cake');
  if (left && right && cake) {
    left.style.transform = `rotateY(${-108 * visible}deg)`;
    right.style.transform = `rotateY(${108 * visible}deg)`;
    cake.style.transform = `translateY(${-24 * visible}px) rotateX(${74 * visible}deg)`;
  }

  const burstPoint = document.getElementById('rsvp').getBoundingClientRect().top;
  if (!partyBurstShown && burstPoint < innerHeight * 0.95) {
    partyBurstShown = true;
    partyBurst?.classList.add('burst-on');
    burstConfetti(150, innerHeight * 0.35);
  }
}

function resizeCanvas() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function burstConfetti(amount = 90, startY = innerHeight * 0.18) {
  const colors = ['#ffb703', '#fb8500', '#0ea5a8', '#7bbf3a', '#fffaf0', '#ff4d8d'];
  confetti = Array.from({ length: amount }, () => ({
    x: innerWidth * (0.15 + Math.random() * 0.7),
    y: startY,
    vx: -6 + Math.random() * 12,
    vy: -5 + Math.random() * 8,
    size: 5 + Math.random() * 10,
    rot: Math.random() * 360,
    spin: -12 + Math.random() * 24,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 95 + Math.random() * 70,
  }));
}

function animateConfetti() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  confetti = confetti.filter(piece => piece.life > 0);
  for (const piece of confetti) {
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.vy += 0.14;
    piece.rot += piece.spin;
    piece.life -= 1;
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rot * Math.PI / 180);
    ctx.globalAlpha = Math.max(0, piece.life / 90);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.55);
    ctx.restore();
  }
  requestAnimationFrame(animateConfetti);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submittedAlready()) {
    lockFormIfSubmitted();
    return;
  }
  const data = new FormData(form);
  const name = normalizeName(data.get('name'));
  if (!name) {
    statusEl.textContent = 'Please type your name first.';
    return;
  }
  const payload = {
    name,
    status: String(data.get('status') || 'going'),
    clientId: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  setSmsLinks(payload);
  statusEl.textContent = 'Saving RSVP...';
  try {
    const response = await submitRsvp(payload);
    const list = Array.isArray(response.rsvps) ? response.rsvps : localRsvps();
    if (response.mode !== 'local-demo') localStorage.setItem(SUBMITTED_KEY, JSON.stringify({ clientId: payload.clientId, name: payload.name, at: new Date().toISOString() }));
    renderBoard(list);
    lockFormIfSubmitted();
    const modeNote = response.mode === 'local-demo'
      ? ' Saved on this device. Live shared RSVP storage needs the backend/API credentials connected.'
      : ' Saved to the live board.';
    statusEl.textContent = payload.status === 'going'
      ? `Awesome — ${payload.name} is on the board.${modeNote}`
      : `Got it — ${payload.name} is marked not going.${modeNote}`;
    burstConfetti();
  } catch (err) {
    statusEl.textContent = err.message || 'Could not save RSVP yet. Please use the text links.';
  }
});

addEventListener('scroll', updateScrollMotion, { passive: true });
addEventListener('resize', () => { resizeCanvas(); updateScrollMotion(); });
setSmsLinks();
resizeCanvas();
refreshCount();
setInterval(refreshCount, 15000);
lockFormIfSubmitted();
updateScrollMotion();
animateConfetti();
