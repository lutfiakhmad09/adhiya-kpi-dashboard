// Builds docs/<slug>/index.html for every dashboard from the page templates in src/.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const shell = fs.readFileSync(path.join(ROOT, 'src', 'shell.html'), 'utf8');
const pribadi = fs.readFileSync(path.join(ROOT, 'src', 'pribadi.html'), 'utf8');
const tim = fs.readFileSync(path.join(ROOT, 'src', 'tim.html'), 'utf8');

const isi = (vars) => shell.replace(/%%(\w+)%%/g, (_, k) => vars[k]);
const tulis = (slug, html) => {
  const dir = path.join(ROOT, 'docs', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
};

for (const p of cfg.people) {
  tulis(p.slug, isi({ TITLE: `KPI ${p.nama} · Adhiya Travel`, NAMA: `KPI ${p.nama}`, SLUG: p.slug, BODY: pribadi,
    PESAN: 'Masukkan password dashboard kamu. Password dibagikan oleh atasan dan hanya untuk kamu.' }));
}
tulis(cfg.atasan.slug, isi({ TITLE: `${cfg.atasan.judul} · Adhiya Travel`, NAMA: 'Tim Marketing', SLUG: cfg.atasan.slug, BODY: tim,
  PESAN: 'Dashboard khusus atasan, berisi KPI seluruh tim. Masukkan password atasan.' }));
console.log('Halaman dibuat:', cfg.people.length + 1);
