#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dataPath = path.join(root, 'rsvps.json');
const port = Number(process.env.PORT || 4173);
const parentPhone = '5186103096';
const zaynePhone = '2074407812';

function readRsvps() {
  try { return JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
  catch { return []; }
}

function writeRsvps(list) {
  fs.writeFileSync(dataPath, JSON.stringify(list, null, 2));
}

function summary(list) {
  const goingCount = list.filter(r => r.status === 'going').reduce((sum, r) => sum + Number(r.count || 1), 0);
  return { goingCount, totalResponses: list.length };
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sanitize(input) {
  return String(input || '').replace(/[<>]/g, '').trim().slice(0, 300);
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000) reject(new Error('request too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function maybeNotifyPhones(rsvp, totals) {
  // Live automatic SMS needs an approved provider such as Twilio, Telnyx,
  // or CAK3D's existing SMS gateway. This local server intentionally does
  // not send texts by itself; it logs the notification payload shape only.
  const line = `[RSVP notify pending SMS provider] parent=${parentPhone} zayne=${zaynePhone} name=${rsvp.name} status=${rsvp.status} count=${rsvp.count} goingTotal=${totals.goingCount}`;
  console.log(line);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/rsvp' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, ...summary(readRsvps()) });
    }
    if (url.pathname === '/api/rsvp' && req.method === 'POST') {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const rsvp = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: sanitize(body.name),
        count: Math.max(1, Math.min(8, Number(body.count || 1))),
        status: body.status === 'not-going' ? 'not-going' : 'going',
        note: sanitize(body.note),
        at: new Date().toISOString(),
      };
      if (!rsvp.name) return sendJson(res, 400, { ok: false, error: 'name required' });
      const list = readRsvps();
      list.push(rsvp);
      writeRsvps(list);
      const totals = summary(list);
      await maybeNotifyPhones(rsvp, totals);
      return sendJson(res, 200, { ok: true, ...totals, rsvp });
    }

    let filePath = path.normalize(path.join(root, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!filePath.startsWith(root)) {
      res.writeHead(403); return res.end('Forbidden');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(data);
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Zayne invite preview running at http://0.0.0.0:${port}`);
});
