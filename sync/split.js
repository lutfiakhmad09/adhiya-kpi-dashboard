// Turns raw Google Sheets answers into the data each dashboard needs.
// raw: { periode: {values}, capaian: {values}, inputs: { "<Nama>": {values} } }, values as formatted text.

// Indonesian number text -> number. A dot followed by exactly 3 digits is a thousands separator,
// otherwise a dot is read as a decimal point (some cells are typed as 0.86 instead of 0,86).
const num = (s) => {
  if (s == null) return null;
  let t = String(s).replace('%', '').trim();
  if (t === '' || t === '-') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const isDate = (s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(s ?? '').trim());
const iso = (s) => { const [d, m, y] = String(s).trim().split('/'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; };

// riwayat: { "<periode>": [rows] }. The sheet only computes the month chosen in
// 'Capaian KPI Bulanan'!B2, so each sync replaces that month's snapshot and keeps the others.
function split(raw, riwayat, diperbarui) {
  const periode = ((raw.periode.values || [])[0] || [])[1] || '';
  const capaianAktif = (raw.capaian.values || []).slice(1).filter((r) => num(r[0]) != null).map((r) => ({
    no: num(r[0]), periode, divisi: r[1] || '', nama: r[2] || '', kpi: r[3] || '', satuan: r[4] || '',
    target: num(r[5]), minggu_ada_data: num(r[6]), aktual: num(r[7]), target_bulan_ini: num(r[8]),
    capaian_pct: num(r[9]), status: r[10] || '', diperbarui,
  }));
  if (!periode || !capaianAktif.length) throw new Error('Sheet Capaian KPI Bulanan kosong atau periode B2 tidak terbaca');
  const baru = { ...riwayat, [periode]: capaianAktif };
  const capaian = Object.values(baru).flat();

  const perOrang = {};
  const semuaMingguan = [];
  for (const [nama, ans] of Object.entries(raw.inputs)) {
    const vals = ans.values || [];
    const header = vals[0] || [];
    // Columns are found by header name, so helper columns ("Minggu Dihitung", "Bulan",
    // "Jenis Minggu") never shift the KPI columns. Placeholder headers such as "-" are skipped.
    const named = header.map((h, i) => ({ i, name: String(h || '').split('\n')[0].trim() }));
    const bulanCol = (named.find((c) => /^Bulan/i.test(c.name)) || { i: 1 }).i;
    const cols = named.filter((c) => c.i >= 1 && /[A-Za-z]/.test(c.name) && !/^(Bulan|Minggu Dihitung|Jenis Minggu)/i.test(c.name));
    const rows = vals.slice(1).filter((r) => isDate(r[0])).map((r) => {
      const row = { tanggal: iso(r[0]), bulan: r[bulanCol] || '' };
      cols.forEach((c) => { row[c.name] = num(r[c.i]); });
      return row;
    });
    rows.forEach((row) => cols.forEach((c, urutan) => {
      if (row[c.name] != null) semuaMingguan.push({ nama, tanggal: row.tanggal, bulan: row.bulan, urutan, kolom: c.name, nilai: row[c.name] });
    }));
    perOrang[nama] = {
      kpi: capaian.filter((r) => r.nama === nama),
      mingguan: { columns: ['tanggal', 'bulan', ...cols.map((c) => c.name)], rows },
    };
  }
  return { periode, perOrang, semua: { kpi: capaian, mingguan: semuaMingguan }, riwayat: baru };
}

module.exports = { split, num };
