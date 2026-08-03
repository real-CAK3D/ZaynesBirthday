const DATA_OWNER = process.env.RSVP_DATA_OWNER || 'real-CAK3D';
const DATA_REPO = process.env.RSVP_DATA_REPO || 'ZaynesBirthday';
const DATA_BRANCH = process.env.RSVP_DATA_BRANCH || 'main';
const DATA_PATH = process.env.RSVP_DATA_PATH || 'data/rsvps.json';
const TOKEN = process.env.RSVP_STORE_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

function sanitize(input, max = 300) {
  return String(input || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function publicList(list) {
  return list.map(({ name, status, at }) => ({ name, status, at }));
}

function summary(list) {
  const goingCount = list.filter(rsvp => rsvp.status === 'going').length;
  return { goingCount, totalResponses: list.length, rsvps: publicList(list) };
}

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.json(body);
}

async function githubRequest(url, options = {}) {
  if (!TOKEN) throw new Error('RSVP storage token is not configured');
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || `GitHub storage error ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return data;
}

async function readStore() {
  const url = `https://api.github.com/repos/${DATA_OWNER}/${DATA_REPO}/contents/${encodeURIComponent(DATA_PATH).replace(/%2F/g, '/')}?ref=${DATA_BRANCH}`;
  try {
    const data = await githubRequest(url);
    const content = Buffer.from(data.content || '', 'base64').toString('utf8');
    const list = JSON.parse(content || '[]');
    return { list: Array.isArray(list) ? list : [], sha: data.sha };
  } catch (err) {
    if (err.status === 404) return { list: [], sha: null };
    throw err;
  }
}

async function writeStore(list, sha) {
  const url = `https://api.github.com/repos/${DATA_OWNER}/${DATA_REPO}/contents/${encodeURIComponent(DATA_PATH).replace(/%2F/g, '/')}`;
  const body = {
    message: 'Update Zayne RSVP board',
    branch: DATA_BRANCH,
    content: Buffer.from(JSON.stringify(list, null, 2) + '\n').toString('base64'),
  };
  if (sha) body.sha = sha;
  return githubRequest(url, { method: 'PUT', body: JSON.stringify(body) });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { list } = await readStore();
      return json(res, 200, { ok: true, mode: 'github-store', ...summary(list) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
      const rsvp = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        clientId: sanitize(body.clientId, 120),
        name: sanitize(body.name, 80),
        status: body.status === 'not-going' ? 'not-going' : 'going',
        at: new Date().toISOString(),
      };
      if (!rsvp.name) return json(res, 400, { ok: false, error: 'name required' });
      if (!rsvp.clientId) return json(res, 400, { ok: false, error: 'client id required' });

      const { list, sha } = await readStore();
      if (list.some(item => item.clientId === rsvp.clientId)) {
        return json(res, 409, { ok: false, error: 'duplicate RSVP blocked for this device', ...summary(list) });
      }
      list.push(rsvp);
      await writeStore(list, sha);
      return json(res, 200, { ok: true, mode: 'github-store', ...summary(list), rsvp: { name: rsvp.name, status: rsvp.status, at: rsvp.at } });
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'method not allowed' });
  } catch (err) {
    const status = err.status && err.status < 500 ? err.status : 503;
    return json(res, status, { ok: false, error: err.message || 'RSVP storage unavailable' });
  }
};
