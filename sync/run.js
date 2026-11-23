// Daily sync: reads the KPI spreadsheet, splits it per person, and writes one encrypted file per
// dashboard into docs/data. Run by GitHub Actions; never prints KPI values, because Actions logs
// of a public repo are public.
//
//   node sync/run.js                      read the sheet (env GOOGLE_SERVICE_ACCOUNT, KPI_SECRETS)
//   node sync/run.js --raw raw.json       use saved sheet answers instead of the API
//   node sync/run.js --secrets file.json  read passwords from a file instead of KPI_SECRETS
//   node sync/run.js --riwayat-awal f     seed the month history when docs/data/riwayat.json is absent
const fs = require('fs');
const path = require('path');
const { split } = require('./split');
const { kunci, buka } = require('./kunci');
const { batchGet } = require('./sheets');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'docs', 'data');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

async function ambilSheet(cfg) {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || 'null');
  if (!sa) throw new Error('Secret GOOGLE_SERVICE_ACCOUNT belum diisi');
  const ranges = [
    "'Capaian KPI Bulanan'!A2:E2",
    "'Capaian KPI Bulanan'!A4:K300",
    ...cfg.people.map((p) => `'Input - ${p.nama}'!A4:BZ300`),
  ];
  const [periode, capaian, ...inputs] = await batchGet(sa, cfg.spreadsheetId, ranges);
  return { periode, capaian, inputs: Object.fromEntries(cfg.people.map((p, i) => [p.nama, inputs[i]])) };
}

async function main() {
  const cfg = readJson(path.join(ROOT, 'config.json'));
  const rahasia = arg('--secrets') ? readJson(arg('--secrets')) : JSON.parse(process.env.KPI_SECRETS || 'null');
  if (!rahasia || !rahasia.master || !rahasia.passwords) throw new Error('Secret KPI_SECRETS belum diisi');
  const semuaSlug = [...cfg.people.map((p) => p.slug), cfg.atasan.slug];
  const kurang = semuaSlug.filter((s) => !rahasia.passwords[s]);
  if (kurang.length) throw new Error('Password belum ada untuk: ' + kurang.join(', '));

  const raw = arg('--raw') ? readJson(arg('--raw')) : await ambilSheet(cfg);

  const riwayatFile = path.join(DATA, 'riwayat.json');
  const riwayat = fs.existsSync(riwayatFile) ? buka(readJson(riwayatFile), rahasia.master)
    : arg('--riwayat-awal') ? readJson(arg('--riwayat-awal')) : {};

  const hasil = split(raw, riwayat, new Date().toISOString());

  fs.mkdirSync(DATA, { recursive: true });
  const tulis = (slug, obj) => fs.writeFileSync(path.join(DATA, slug + '.json'), JSON.stringify(kunci(obj, rahasia.passwords[slug])));
  for (const p of cfg.people) {
    const d = hasil.perOrang[p.nama] || { kpi: [], mingguan: { columns: [], rows: [] } };
    // Each personal file holds only that person's rows.
    if (d.kpi.some((r) => r.nama !== p.nama)) throw new Error('Data orang lain ikut masuk ke ' + p.slug);
    tulis(p.slug, { nama: p.nama, kpi: d.kpi, mingguan: d.mingguan });
  }
  tulis(cfg.atasan.slug, { nonaktif: cfg.nonaktif, kpi: hasil.semua.kpi, mingguan: hasil.semua.mingguan });
  fs.writeFileSync(riwayatFile, JSON.stringify(kunci(hasil.riwayat, rahasia.master)));

  console.log(`Periode aktif: ${hasil.periode}`);
  console.log(`Arsip bulan: ${Object.keys(hasil.riwayat).join(', ')}`);
  console.log(`Dashboard diperbarui: ${semuaSlug.length}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
