const RSVP_PARENT = '5186103096';
const RSVP_ZAYNE = '2074407812';
const API = '/api/rsvp';

const cube = document.getElementById('party-cube');
const unfold = document.getElementById('unfold-card');
const countEl = document.getElementById('going-count');
const form = document.getElementById('rsvp-form');
const statusEl = document.getElementById('form-status');
const parentSms = document.getElementById('parent-sms');
const zayneSms = document.getElementById('zayne-sms');
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');

let confetti = [];
let lastKnownCount = 0;

function setSmsLinks(payload = {}) {
  const name = payload.name || 'Friend';
  const count = payload.count || 1;
  const status = payload.status === 'not-going' ? "can't make it" : 'is going';
  const note = payload.note ? ` Note: ${payload.note}` : '';
  const message = encodeURIComponent(`Zayne birthday RSVP: ${name} ${status}. Count: ${count}.${note}`);
  parentSms.href = `sms:${RSVP_PARENT}?&body=${message}`;
  zayneSms.href = `sms:${RSVP_ZAYNE}?&body=${message}`;
}

function localRsvps() {
  try { return JSON.parse(localStorage.getItem('zayne-range-pond-rsvps') || '[]'); }
  catch { return []; }
}

function saveLocal(payload) {
  const list = localRsvps();
  const cleaned = { ...payload, at: new Date().toISOString() };
  list.push(cleaned);
  localStorage.setItem('zayne-range-pond-rsvps', JSON.stringify(list));
  return list;
}

function localGoingCount() {
  return localRsvps().filter(r => r.status === 'going').reduce((sum, r) => sum + Number(r.count || 1), 0);
}

async function refreshCount() {
  try {
    const res = await fetch(API, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    lastKnownCount = Number(data.goingCount || 0);
  } catch {
    lastKnownCount = localGoingCount();
  }
  countEl.textContent = String(lastKnownCount);
}

async function submitRsvp(payload) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch {
    const list = saveLocal(payload);
    return { ok: true, mode: 'local-demo', goingCount: localGoingCount(), totalResponses: list.length };
  }
}

function updateScrollMotion() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max ? scrollY / max : 0;
  const cubeSpin = p * 720;
  const cubeTilt = Math.sin(p * Math.PI * 3) * 28;
  const cubeRoll = Math.cos(p * Math.PI * 2) * 18;
  cube.style.transform = `rotateX(${cubeTilt - cubeSpin * 0.28}deg) rotateY(${cubeSpin}deg) rotateZ(${cubeRoll}deg)`;

  const rect = unfold.getBoundingClientRect();
  const visible = Math.min(1, Math.max(0, (innerHeight - rect.top) / (innerHeight * 0.9)));
  const left = unfold.querySelector('.flap-left');
  const right = unfold.querySelector('.flap-right');
  if (left && right) {
    left.style.transform = `rotateY(${-110 * visible}deg)`;
    right.style.transform = `rotateY(${110 * visible}deg)`;
  }
}

function resizeCanvas() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function burstConfetti() {
  const colors = ['#ffb703', '#fb8500', '#0ea5a8', '#7bbf3a', '#fffaf0'];
  confetti = Array.from({ length: 90 }, () => ({
    x: innerWidth * (0.25 + Math.random() * 0.5),
    y: innerHeight * 0.18,
    vx: -5 + Math.random() * 10,
    vy: -3 + Math.random() * 7,
    size: 6 + Math.random() * 8,
    rot: Math.random() * 360,
    spin: -10 + Math.random() * 20,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 90 + Math.random() * 50,
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
  const data = new FormData(form);
  const payload = {
    name: String(data.get('name') || '').trim(),
    count: Math.max(1, Math.min(8, Number(data.get('count') || 1))),
    status: String(data.get('status') || 'going'),
    note: String(data.get('note') || '').trim(),
  };
  setSmsLinks(payload);
  statusEl.textContent = 'Sending RSVP...';
  const response = await submitRsvp(payload);
  lastKnownCount = Number(response.goingCount ?? localGoingCount());
  countEl.textContent = String(lastKnownCount);
  const modeNote = response.mode === 'local-demo'
    ? ' Saved on this device for demo. Use the text links below until the live backend is connected.'
    : ' RSVP sent and count refreshed.';
  statusEl.textContent = payload.status === 'going'
    ? `Awesome — ${payload.name || 'friend'} is on the board.${modeNote}`
    : `Got it — thanks for letting us know.${modeNote}`;
  burstConfetti();
});

addEventListener('scroll', updateScrollMotion, { passive: true });
addEventListener('resize', () => { resizeCanvas(); updateScrollMotion(); });
setSmsLinks();
resizeCanvas();
refreshCount();
setInterval(refreshCount, 15000);
updateScrollMotion();
animateConfetti();
