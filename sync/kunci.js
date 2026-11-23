// Password-based encryption shared with the pages: PBKDF2-SHA256 -> AES-256-GCM.
// The browser decrypts with WebCrypto, which expects the auth tag appended to the ciphertext.
const crypto = require('crypto');

const ITER = 310000;

function kunci(obj, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()]);
  return { v: 1, iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };
}

function buka(box, password) {
  const key = crypto.pbkdf2Sync(password, Buffer.from(box.salt, 'base64'), box.iter, 32, 'sha256');
  const all = Buffer.from(box.ct, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(all.subarray(all.length - 16));
  return JSON.parse(Buffer.concat([d.update(all.subarray(0, all.length - 16)), d.final()]).toString('utf8'));
}

module.exports = { kunci, buka };
