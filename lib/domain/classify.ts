import type { AlasanBarisBermasalah, KelompokPegawai } from "@/lib/constants";
import type { RawNominatifRow } from "@/lib/excel/types";

import type { KamusMap, MasterCache } from "./masterCache";
import {
  exactMatch,
  extractGolonganCode,
  kunciKamus,
  matchJabatanFungsionalTendik,
  matchStatusAgainstKategori,
  normalize,
  prefixOrExactMatch,
  prefixWordMatch,
} from "./matching";

export type Issue = { alasan: AlasanBarisBermasalah; detail: string };

export type JabatanTambahanSlot = {
  jabatanTambahanRoleKode: string;
  unitAsalKode: string | null;
  programStudiKode: string | null;
  statusPengangkatan: string;
};

export type ResolvedNominatif = {
  nama: string;
  jenisKelamin: "L" | "P";
  tanggalLahir: Date;
  pendidikanTerakhir: string | null;
  agama: string | null;
  jenisPegawaiKode: string;
  statusKepegawaianKode: string;
  golonganKode: string | null;
  jabatanFungsionalDosenKode: string | null;
  jabatanFungsionalTendikKode: string | null;
  jabatanFungsiUmumKode: string | null;
  kategoriAkademisiLuarKode: string | null;
  unitAsalKode: string;
  tanggalMulaiKerja: Date;
  jabatanTambahan: JabatanTambahanSlot | null;
};

export type ClassifyResult =
  | { ok: true; data: ResolvedNominatif }
  | { ok: false; issues: Issue[] };

const ALASAN_PRIORITAS: AlasanBarisBermasalah[] = [
  "KlasifikasiAmbigu",
  "StatusTidakDikenali",
  "GolonganTidakDikenali",
  "JabatanTidakDikenali",
  "JabatanTambahanTidakDikenali",
  "UnitKerjaTidakDikenali",
  "PendidikanTidakDikenali",
  "Lainnya",
];

/** Kunci kamus koreksi per jenis field - dipakai baik oleh classify.ts maupun resolveRow.ts
 *  supaya keduanya selalu sepakat soal bagaimana sebuah nilai mentah "diingat". */
export const kunciKlasifikasi = (row: Pick<RawNominatifRow, "jenisPegawaiRaw" | "statusPegawaiRaw">) =>
  kunciKamus(row.jenisPegawaiRaw, row.statusPegawaiRaw);
export const kunciKategoriAkademisiLuar = (row: Pick<RawNominatifRow, "jenisPegawaiRaw" | "statusPegawaiRaw">) =>
  kunciKamus(row.statusPegawaiRaw, row.jenisPegawaiRaw);
export const kunciStatusKepegawaian = (row: Pick<RawNominatifRow, "statusPegawaiRaw">) =>
  kunciKamus(row.statusPegawaiRaw);
export const kunciGolongan = (row: Pick<RawNominatifRow, "golonganPangkatRaw">) =>
  kunciKamus(row.golonganPangkatRaw);
export const kunciJabatan = (row: Pick<RawNominatifRow, "jabatanFungsionalRaw">) =>
  kunciKamus(row.jabatanFungsionalRaw);
export const kunciUnitKerja = (row: Pick<RawNominatifRow, "subagUnitKerjaRaw" | "unitKerjaIndukRaw">) =>
  kunciKamus(row.subagUnitKerjaRaw, row.unitKerjaIndukRaw);
export const kunciJabatanTambahan = (row: Pick<RawNominatifRow, "jabatanTambahanRaw">) =>
  kunciKamus(row.jabatanTambahanRaw);

/**
 * Kamus koreksi menyimpan 1 String per entri, jadi resolusi Jabatan Tambahan (role + unit/prodi
 * + status pengangkatan sekaligus) di-encode jadi 1 string komposit "role|target|status".
 */
export function encodeJabatanTambahan(slot: JabatanTambahanSlot): string {
  const target = slot.unitAsalKode
    ? `UNIT:${slot.unitAsalKode}`
    : slot.programStudiKode
      ? `PRODI:${slot.programStudiKode}`
      : "NONE";
  return `${slot.jabatanTambahanRoleKode}|${target}|${slot.statusPengangkatan}`;
}

function decodeJabatanTambahan(encoded: string): JabatanTambahanSlot | null {
  const parts = encoded.split("|");
  if (parts.length !== 3) return null;
  const [roleKode, target, statusPengangkatan] = parts;
  return {
    jabatanTambahanRoleKode: roleKode,
    unitAsalKode: target.startsWith("UNIT:") ? target.slice(5) : null,
    programStudiKode: target.startsWith("PRODI:") ? target.slice(6) : null,
    statusPengangkatan,
  };
}

function dariKamus(kamus: KamusMap, jenisField: string, kunci: string): string | undefined {
  return kamus.get(`${jenisField}::${kunci}`);
}

function kodeJenisPegawai(master: MasterCache, kelompok: KelompokPegawai): string {
  const found = master.jenisPegawai.find((j) => normalize(j.nama) === normalize(kelompok));
  if (!found) throw new Error(`Master JenisPegawai untuk "${kelompok}" tidak ditemukan - seed data rusak?`);
  return found.kode;
}

/** Urutan prioritas klasifikasi kelompok, dikonfirmasi user (lihat plan §4). */
export function resolveKelompok(
  row: RawNominatifRow,
  master: MasterCache,
  kamus: KamusMap
): { kelompok: KelompokPegawai } | { issue: Issue } {
  if (row.kelompokJabatanRaw) {
    const literal = row.kelompokJabatanRaw.trim();
    if (["Dosen", "Tendik", "Akademisi Luar UM"].includes(literal)) {
      return { kelompok: literal as KelompokPegawai };
    }
  }

  const diingat = dariKamus(kamus, "Klasifikasi", kunciKlasifikasi(row));
  if (diingat && ["Dosen", "Tendik", "Akademisi Luar UM"].includes(diingat)) {
    return { kelompok: diingat as KelompokPegawai };
  }

  if (matchStatusAgainstKategori(master.kategoriAkademisiLuar, (k) => k.nama, row.statusPegawaiRaw)) {
    return { kelompok: "Akademisi Luar UM" };
  }
  if (normalize(row.statusPegawaiRaw) === normalize("Akademisi Luar UM")) {
    return { kelompok: "Akademisi Luar UM" };
  }
  if (prefixOrExactMatch(master.kategoriAkademisiLuar, (k) => k.nama, row.jenisPegawaiRaw)) {
    return { kelompok: "Akademisi Luar UM" };
  }
  if (normalize(row.jenisPegawaiRaw) === normalize("Dosen")) {
    return { kelompok: "Dosen" };
  }
  if (!row.jenisPegawaiRaw.trim()) {
    return {
      issue: {
        alasan: "KlasifikasiAmbigu",
        detail: 'Kolom "Jenis Pegawai" dan "Status Pegawai" sama-sama kosong/tidak dikenali.',
      },
    };
  }
  return { kelompok: "Tendik" };
}

export function resolveKategoriAkademisiLuar(
  row: RawNominatifRow,
  master: MasterCache,
  kamus: KamusMap
): { kode: string } | { issue: Issue } {
  const diingat = dariKamus(kamus, "KategoriAkademisiLuar", kunciKategoriAkademisiLuar(row));
  if (diingat && master.kategoriAkademisiLuar.some((k) => k.kode === diingat)) return { kode: diingat };

  const byStatus = matchStatusAgainstKategori(master.kategoriAkademisiLuar, (k) => k.nama, row.statusPegawaiRaw);
  if (byStatus) return { kode: byStatus.kode };
  const byJenis = prefixOrExactMatch(master.kategoriAkademisiLuar, (k) => k.nama, row.jenisPegawaiRaw);
  if (byJenis) return { kode: byJenis.kode };
  return {
    issue: {
      alasan: "KlasifikasiAmbigu",
      detail: `Kelompok sudah pasti Akademisi Luar UM, tapi kategori spesifiknya tidak cocok master (mentah: Jenis Pegawai="${row.jenisPegawaiRaw}", Status Pegawai="${row.statusPegawaiRaw}").`,
    },
  };
}

export function resolveStatusKepegawaian(
  row: RawNominatifRow,
  master: MasterCache,
  kamus: KamusMap
): { kode: string; kategori: string } | { issue: Issue } {
  const diingat = dariKamus(kamus, "StatusKepegawaian", kunciStatusKepegawaian(row));
  if (diingat) {
    const found = master.statusKepegawaian.find((s) => s.kode === diingat);
    if (found) return { kode: found.kode, kategori: found.kategori };
  }

  const byKode = master.statusKepegawaian.find(
    (s) => normalize(s.kode) === normalize(row.statusPegawaiRaw)
  );
  if (byKode) return { kode: byKode.kode, kategori: byKode.kategori };
  const byNama = exactMatch(master.statusKepegawaian, (s) => s.nama, row.statusPegawaiRaw);
  if (byNama) return { kode: byNama.kode, kategori: byNama.kategori };
  return {
    issue: {
      alasan: "StatusTidakDikenali",
      detail: `Status Pegawai mentah "${row.statusPegawaiRaw}" tidak cocok dengan master Status Kepegawaian manapun.`,
    },
  };
}

export function resolveGolongan(
  row: RawNominatifRow,
  master: MasterCache,
  kamus: KamusMap,
  statusKategori: string
): { kode: string | null } | { issue: Issue } {
  if (statusKategori !== "ASN") return { kode: null };

  const diingat = dariKamus(kamus, "Golongan", kunciGolongan(row));
  if (diingat && master.golongan.some((g) => g.kode === diingat)) return { kode: diingat };

  const extracted = extractGolonganCode(row.golonganPangkatRaw);
  if (!extracted) {
    return {
      issue: {
        alasan: "GolonganTidakDikenali",
        detail: `Status ASN tapi golongan tidak bisa diekstrak dari teks "${row.golonganPangkatRaw}".`,
      },
    };
  }
  const found = master.golongan.find((g) => g.kode === extracted);
  if (!found) {
    return {
      issue: {
        alasan: "GolonganTidakDikenali",
        detail: `Kode golongan "${extracted}" (dari teks "${row.golonganPangkatRaw}") tidak ada di master.`,
      },
    };
  }
  return { kode: found.kode };
}

type JabatanResolusi = {
  jabatanFungsionalDosenKode: string | null;
  jabatanFungsionalTendikKode: string | null;
  jabatanFungsiUmumKode: string | null;
};

export function resolveJabatan(
  row: RawNominatifRow,
  master: MasterCache,
  kamus: KamusMap,
  kelompok: KelompokPegawai
): JabatanResolusi | { issue: Issue } {
  const kunci = kunciJabatan(row);

  if (kelompok === "Dosen") {
    const diingat = dariKamus(kamus, "JabatanFungsionalDosen", kunci);
    const dariMaster =
      (diingat && master.jabatanFungsionalDosen.find((j) => j.kode === diingat)) ||
      exactMatch(master.jabatanFungsionalDosen, (j) => j.nama, row.jabatanFungsionalRaw) ||
      // Master pakai label lengkap "Guru Besar (Profesor)" tapi sumber data biasa cuma tulis
      // "Guru Besar" - fallback ini HANYA jalan kalau exactMatch di atas gagal, jadi raw yang
      // persis "Lektor" tetap match ke "Lektor" duluan, tidak pernah nyasar ke "Lektor Kepala".
      prefixWordMatch(master.jabatanFungsionalDosen, (j) => j.nama, row.jabatanFungsionalRaw);
    if (!dariMaster) {
      return {
        issue: {
          alasan: "JabatanTidakDikenali",
          detail: `Jabatan Fungsional Dosen mentah "${row.jabatanFungsionalRaw}" tidak cocok master.`,
        },
      };
    }
    return { jabatanFungsionalDosenKode: dariMaster.kode, jabatanFungsionalTendikKode: null, jabatanFungsiUmumKode: null };
  }

  if (kelompok === "Tendik") {
    const diingatTendik = dariKamus(kamus, "JabatanFungsionalTendik", kunci);
    const tendik =
      (diingatTendik && master.jabatanFungsionalTendik.find((j) => j.kode === diingatTendik)) ||
      matchJabatanFungsionalTendik(master.jabatanFungsionalTendik, row.jabatanFungsionalRaw);
    if (tendik) {
      return { jabatanFungsionalDosenKode: null, jabatanFungsionalTendikKode: tendik.kode, jabatanFungsiUmumKode: null };
    }

    const diingatUmum = dariKamus(kamus, "FungsiUmumPelaksana", kunci);
    const umum =
      (diingatUmum && master.jabatanFungsiUmumPelaksana.find((j) => j.kode === diingatUmum)) ||
      exactMatch(master.jabatanFungsiUmumPelaksana, (j) => j.nama, row.jabatanFungsionalRaw);
    if (umum) {
      return { jabatanFungsionalDosenKode: null, jabatanFungsionalTendikKode: null, jabatanFungsiUmumKode: umum.kode };
    }

    return {
      issue: {
        alasan: "JabatanTidakDikenali",
        detail: row.jabatanFungsionalRaw
          ? `Jabatan Fungsional Tendik mentah "${row.jabatanFungsionalRaw}" tidak cocok master fungsional tertentu maupun Fungsi Umum Pelaksana.`
          : "Tidak ada Jabatan Fungsional di data sumber untuk Tendik ini - pilih Fungsi Umum Pelaksana yang sesuai secara manual.",
      },
    };
  }

  // Akademisi Luar UM tidak wajib punya jabatan fungsional/fungsi.
  return { jabatanFungsionalDosenKode: null, jabatanFungsionalTendikKode: null, jabatanFungsiUmumKode: null };
}

export function resolveUnitKerja(
  row: RawNominatifRow,
  master: MasterCache,
  kamus: KamusMap
): { kode: string } | { issue: Issue } {
  const diingat = dariKamus(kamus, "UnitKerja", kunciUnitKerja(row));
  if (diingat && master.unitAsal.some((u) => u.kode === diingat)) return { kode: diingat };

  const kandidat = [row.subagUnitKerjaRaw, row.unitKerjaIndukRaw, row.direktoratFakultasRaw, row.unitStatistikRaw];
  for (const raw of kandidat) {
    const found = exactMatch(master.unitAsal, (u) => u.nama, raw);
    if (found) return { kode: found.kode };
  }
  return {
    issue: {
      alasan: "UnitKerjaTidakDikenali",
      detail: `Tidak ada kandidat unit kerja ("${row.subagUnitKerjaRaw}" / "${row.unitKerjaIndukRaw}" / "${row.direktoratFakultasRaw}" / "${row.unitStatistikRaw}") yang cocok dengan master Unit Asal.`,
    },
  };
}

const PREFIX_STATUS_PENGANGKATAN = /^(plt\.?|pjs\.?)\s+/i;

/**
 * Sebagian teks Jabatan Tambahan diawali singkatan status pengangkatan yang eksplisit ("Plt."
 * = Pelaksana Tugas, "Pjs." = Pejabat Sementara) - ini SINYAL LANGSUNG dari data sumber, bukan
 * tebakan, jadi diekstrak & dipakai. Kalau tidak ada awalan ini sama sekali, statusnya TETAP
 * tidak diasumsikan "Definitif" secara diam-diam - baris tetap perlu resolusi manual sekali.
 */
function ekstrakStatusPengangkatan(raw: string): { sisaTeks: string; status: "Plt" | "Pjs" | null } {
  const m = raw.match(PREFIX_STATUS_PENGANGKATAN);
  if (!m) return { sisaTeks: raw, status: null };
  const status = m[1].toLowerCase().startsWith("plt") ? "Plt" : "Pjs";
  return { sisaTeks: raw.slice(m[0].length), status };
}

/**
 * Raw "Jabatan Tambahan" menggabungkan nama role + unit/prodi dalam 1 sel TANPA pemisah yang
 * konsisten - kadang koma ("Kepala Sub Direktorat Layanan Pendidikan, Direktorat Pendidikan"),
 * kadang tanpa apa pun ("Dekan Fakultas Ilmu Sosial"). Jadi dicari lewat KANDIDAT AWALAN dari
 * 79 nama role master (dicoba dari yang PALING PANJANG/spesifik dulu, supaya "Kepala Pusat
 * Evaluasi Pendidikan" tidak salah kepotong jadi "Kepala Pusat"), lalu sisanya (setelah dibuang
 * koma/spasi pemisah) divalidasi harus PERSIS cocok nama Unit Asal atau Program Studi. Kalau
 * sisa tidak cocok apa pun, kandidat itu ditolak dan dicoba kandidat role berikutnya - tetap
 * deterministik (exact match di kedua sisi), bukan tebakan posisi atau fuzzy.
 */
export function pisahJabatanTambahanRaw(
  raw: string,
  master: MasterCache
): { roleRaw: string; unit?: { kode: string }; prodi?: { kode: string }; status: "Plt" | "Pjs" | null } {
  const { sisaTeks, status } = ekstrakStatusPengangkatan(raw.trim());
  const rawNorm = normalize(sisaTeks);

  const kandidatRole = master.jabatanTambahanRole
    .filter((r) => {
      const roleNorm = normalize(r.namaRole);
      if (!rawNorm.startsWith(roleNorm)) return false;
      const sisa = rawNorm.slice(roleNorm.length);
      return sisa === "" || sisa.startsWith(" ") || sisa.startsWith(",");
    })
    .sort((a, b) => b.namaRole.length - a.namaRole.length);

  for (const role of kandidatRole) {
    let sisa = rawNorm.slice(normalize(role.namaRole).length).trim();
    if (sisa.startsWith(",")) sisa = sisa.slice(1).trim();
    if (!sisa) return { roleRaw: role.namaRole, status };

    const unit = master.unitAsal.find((u) => normalize(u.nama) === sisa);
    if (unit) return { roleRaw: role.namaRole, unit: { kode: unit.kode }, status };
    const prodi = master.programStudi.find((p) => normalize(p.nama) === sisa);
    if (prodi) return { roleRaw: role.namaRole, prodi: { kode: prodi.kode }, status };
  }

  return { roleRaw: sisaTeks, status };
}

/**
 * Jabatan Tambahan opsional - kosong di data sumber = tidak menjabat, bukan error. Akademisi
 * Luar UM tidak pernah punya jabatan tambahan struktural. Status Pengangkatan (Definitif/Plt/
 * Pjs) TIDAK PERNAH punya sinyal di data sumber sama sekali - satu-satunya jalan sukses tanpa
 * review manual adalah lewat kamus koreksi yang sudah pernah diisi admin sebelumnya.
 */
export function resolveJabatanTambahan(
  row: RawNominatifRow,
  master: MasterCache,
  kamus: KamusMap,
  kelompok: KelompokPegawai
): { slot: JabatanTambahanSlot | null } | { issue: Issue } {
  if (!row.jabatanTambahanRaw.trim() || kelompok === "Akademisi Luar UM") {
    return { slot: null };
  }

  const diingat = dariKamus(kamus, "JabatanTambahan", kunciJabatanTambahan(row));
  if (diingat) {
    const decoded = decodeJabatanTambahan(diingat);
    if (
      decoded &&
      master.jabatanTambahanRole.some((r) => r.kode === decoded.jabatanTambahanRoleKode) &&
      (!decoded.unitAsalKode || master.unitAsal.some((u) => u.kode === decoded.unitAsalKode)) &&
      (!decoded.programStudiKode || master.programStudi.some((p) => p.kode === decoded.programStudiKode))
    ) {
      return { slot: decoded };
    }
  }

  const { roleRaw, unit, prodi, status } = pisahJabatanTambahanRaw(row.jabatanTambahanRaw, master);
  const role = exactMatch(master.jabatanTambahanRole, (r) => r.namaRole, roleRaw);

  if (!role || (!unit && !prodi)) {
    return {
      issue: {
        alasan: "JabatanTambahanTidakDikenali",
        detail: `Jabatan Tambahan mentah "${row.jabatanTambahanRaw}" tidak bisa dipetakan lengkap (nama role ${role ? "cocok" : "TIDAK cocok"} master, unit/prodi ${unit || prodi ? "cocok" : "TIDAK cocok"} master).`,
      },
    };
  }

  // Role & unit/prodi ketemu. Kalau teksnya diawali "Plt."/"Pjs." eksplisit, itu SINYAL LANGSUNG
  // status pengangkatan - langsung sukses tanpa review. Kalau tidak ada awalan itu, status
  // TETAP tidak diasumsikan "Definitif" diam-diam - selalu perlu sekali resolusi manual (lalu
  // diingat) sebelum bisa auto-resolve di bulan berikutnya.
  if (status) {
    return {
      slot: {
        jabatanTambahanRoleKode: role.kode,
        unitAsalKode: unit?.kode ?? null,
        programStudiKode: prodi?.kode ?? null,
        statusPengangkatan: status,
      },
    };
  }

  return {
    issue: {
      alasan: "JabatanTambahanTidakDikenali",
      detail: `Jabatan Tambahan "${row.jabatanTambahanRaw}" cocok ke role & unit/prodi, tapi Status Pengangkatan (Definitif/Plt/Pjs) tidak tersedia di data sumber - pilih manual sekali lalu centang "ingat".`,
    },
  };
}

function pilihAlasanUtama(issues: Issue[]): AlasanBarisBermasalah {
  for (const a of ALASAN_PRIORITAS) {
    if (issues.some((i) => i.alasan === a)) return a;
  }
  return "Lainnya";
}

export function classifyRow(row: RawNominatifRow, master: MasterCache, kamus: KamusMap): ClassifyResult {
  const issues: Issue[] = [];

  const kelompokResult = resolveKelompok(row, master, kamus);
  if ("issue" in kelompokResult) {
    // Tanpa kelompok, field lain (jabatan/status) tidak bisa dievaluasi sama sekali.
    return { ok: false, issues: [kelompokResult.issue] };
  }
  const kelompok = kelompokResult.kelompok;

  let kategoriAkademisiLuarKode: string | null = null;
  if (kelompok === "Akademisi Luar UM") {
    const kat = resolveKategoriAkademisiLuar(row, master, kamus);
    if ("issue" in kat) issues.push(kat.issue);
    else kategoriAkademisiLuarKode = kat.kode;
  }

  let statusKepegawaianKode: string;
  let golonganKode: string | null = null;
  if (kelompok === "Akademisi Luar UM") {
    // Aturan master: semua Akademisi Luar UM statusnya PTT.
    statusKepegawaianKode = "PTT";
  } else {
    const status = resolveStatusKepegawaian(row, master, kamus);
    if ("issue" in status) {
      issues.push(status.issue);
      statusKepegawaianKode = "";
    } else {
      statusKepegawaianKode = status.kode;
      const golongan = resolveGolongan(row, master, kamus, status.kategori);
      if ("issue" in golongan) issues.push(golongan.issue);
      else golonganKode = golongan.kode;
    }
  }

  const jabatan = resolveJabatan(row, master, kamus, kelompok);
  let jabatanFungsionalDosenKode: string | null = null;
  let jabatanFungsionalTendikKode: string | null = null;
  let jabatanFungsiUmumKode: string | null = null;
  if ("issue" in jabatan) {
    issues.push(jabatan.issue);
  } else {
    ({ jabatanFungsionalDosenKode, jabatanFungsionalTendikKode, jabatanFungsiUmumKode } = jabatan);
  }

  const unit = resolveUnitKerja(row, master, kamus);
  let unitAsalKode = "";
  if ("issue" in unit) issues.push(unit.issue);
  else unitAsalKode = unit.kode;

  const jabatanTambahan = resolveJabatanTambahan(row, master, kamus, kelompok);
  let jabatanTambahanSlot: JabatanTambahanSlot | null = null;
  if ("issue" in jabatanTambahan) issues.push(jabatanTambahan.issue);
  else jabatanTambahanSlot = jabatanTambahan.slot;

  const nama = row.namaDenganGelar.trim() || row.namaTanpaGelar.trim();
  if (!nama) issues.push({ alasan: "Lainnya", detail: "Nama pegawai kosong di data sumber." });

  const jenisKelamin = row.jenisKelaminRaw.trim().toUpperCase();
  if (jenisKelamin !== "L" && jenisKelamin !== "P") {
    issues.push({ alasan: "Lainnya", detail: `Jenis Kelamin mentah "${row.jenisKelaminRaw}" bukan L/P.` });
  }

  if (!row.tanggalLahir) {
    issues.push({ alasan: "Lainnya", detail: "Tanggal Lahir kosong/tidak valid di data sumber." });
  }
  if (!row.tanggalMasuk) {
    issues.push({ alasan: "Lainnya", detail: "Tanggal Masuk (dipakai sebagai TMT) kosong/tidak valid di data sumber." });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: {
      nama,
      jenisKelamin: jenisKelamin as "L" | "P",
      tanggalLahir: row.tanggalLahir as Date,
      pendidikanTerakhir: row.pendidikanRaw.trim() || null,
      agama: row.agamaRaw.trim() || null,
      jenisPegawaiKode: kodeJenisPegawai(master, kelompok),
      statusKepegawaianKode,
      golonganKode,
      jabatanFungsionalDosenKode,
      jabatanFungsionalTendikKode,
      jabatanFungsiUmumKode,
      kategoriAkademisiLuarKode,
      unitAsalKode,
      tanggalMulaiKerja: row.tanggalMasuk as Date,
      jabatanTambahan: jabatanTambahanSlot,
    },
  };
}

export { pilihAlasanUtama };
