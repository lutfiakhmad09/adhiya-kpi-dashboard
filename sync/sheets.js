// Reads ranges from Google Sheets with a service account, using only Node's standard library.
const crypto = require('crypto');

const b64url = (b) => Buffer.from(b).toString('base64url');

async function token(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Login Google gagal (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

// Values come back as formatted text (spreadsheet locale), the same shape split.js parses.
async function batchGet(sa, spreadsheetId, ranges) {
  const q = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
  ranges.forEach((r) => q.append('ranges', r));
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${q}`, {
    headers: { Authorization: `Bearer ${await token(sa)}` },
  });
  if (!res.ok) throw new Error(`Gagal membaca spreadsheet (${res.status}): ${await res.text()}`);
  return (await res.json()).valueRanges.map((v) => ({ range: v.range, values: v.values || [] }));
}

module.exports = { batchGet };
