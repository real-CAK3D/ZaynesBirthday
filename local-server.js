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

function publicList(list) {
  return list.map(({ name, status, at }) => ({ name, status, at }));
}

function summary(list) {
  const goingCount = list.filter(r => r.status === 'going').length;
  return { goingCount, totalResponses: list.length, rsvps: publicList(list) };
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sanitize(input, max = 300) {
  return String(input || '').replace(/[<>]/g, '').trim().slice(0, max);
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
  const line = `[RSVP notify pending SMS provider] parent=${parentPhone} zayne=${zaynePhone} name=${rsvp.name} status=${rsvp.status} goingTotal=${totals.goingCount}`;
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
      const clientId = sanitize(body.clientId, 120);
      const rsvp = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        clientId,
        name: sanitize(body.name, 80),
        status: body.status === 'not-going' ? 'not-going' : 'going',
        at: new Date().toISOString(),
      };
      if (!rsvp.name) return sendJson(res, 400, { ok: false, error: 'name required' });
      if (!rsvp.clientId) return sendJson(res, 400, { ok: false, error: 'client id required' });
      const list = readRsvps();
      if (list.some(item => item.clientId === rsvp.clientId)) {
        return sendJson(res, 409, { ok: false, error: 'duplicate RSVP blocked for this device', ...summary(list) });
      }
      list.push(rsvp);
      writeRsvps(list);
      const totals = summary(list);
      await maybeNotifyPhones(rsvp, totals);
      return sendJson(res, 200, { ok: true, ...totals, rsvp: { name: rsvp.name, status: rsvp.status, at: rsvp.at } });
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
