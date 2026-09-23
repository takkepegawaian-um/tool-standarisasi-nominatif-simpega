// Nilai "enum-like" disimpan sebagai String biasa di skema Prisma (bukan `enum` Prisma) supaya
// skema tetap portable dari SQLite (dev) ke Postgres (produksi) tanpa perubahan. Union type di
// sini adalah satu-satunya tempat nilai yang sah didefinisikan.

export const STATUS_UPLOAD_BATCH = [
  "Diproses",
  "MenungguReview",
  "Selesai",
  "Dibatalkan",
] as const;
export type StatusUploadBatch = (typeof STATUS_UPLOAD_BATCH)[number];

export const STATUS_BARIS_BERMASALAH = ["Menunggu", "Terselesaikan", "Dikecualikan"] as const;
export type StatusBarisBermasalah = (typeof STATUS_BARIS_BERMASALAH)[number];

export const ALASAN_BARIS_BERMASALAH = [
  "KlasifikasiAmbigu",
  "StatusTidakDikenali",
  "GolonganTidakDikenali",
  "JabatanTidakDikenali",
  "JabatanKosong",
  "JabatanTambahanTidakDikenali",
  "UnitKerjaTidakDikenali",
  "UnitKerjaKosong",
  "PendidikanTidakDikenali",
  "Lainnya",
] as const;
export type AlasanBarisBermasalah = (typeof ALASAN_BARIS_BERMASALAH)[number];

export const ALASAN_LABEL: Record<AlasanBarisBermasalah, string> = {
  KlasifikasiAmbigu: "Klasifikasi kelompok ambigu",
  StatusTidakDikenali: "Status kepegawaian tidak dikenali",
  GolonganTidakDikenali: "Golongan tidak dikenali",
  JabatanTidakDikenali: "Jabatan tidak cocok master (perlu keputusan)",
  // "Kosong" TERPISAH dari "tidak dikenali" (di atas) - bukan kegagalan pencocokan, kolomnya
  // memang kosong total di file sumber, jadi butuh diisi dari sumber lain, bukan dipilihkan.
  JabatanKosong: "Jabatan kosong di file sumber",
  JabatanTambahanTidakDikenali: "Jabatan tambahan tidak cocok master (perlu keputusan)",
  UnitKerjaTidakDikenali: "Unit kerja tidak cocok master (perlu keputusan)",
  UnitKerjaKosong: "Unit kerja kosong di file sumber",
  PendidikanTidakDikenali: "Pendidikan tidak dikenali",
  Lainnya: "Lainnya",
};

export const JENIS_FIELD_KAMUS = [
  "Klasifikasi",
  "StatusKepegawaian",
  "Golongan",
  "JabatanFungsionalDosen",
  "JabatanFungsionalTendik",
  "FungsiUmumPelaksana",
  "KategoriAkademisiLuar",
  "UnitKerja",
  "Pendidikan",
  "JabatanTambahan",
] as const;
export type JenisFieldKamus = (typeof JENIS_FIELD_KAMUS)[number];

export const STATUS_PENGANGKATAN = ["Definitif", "Plt", "Pjs"] as const;
export type StatusPengangkatan = (typeof STATUS_PENGANGKATAN)[number];

export const KELOMPOK_PEGAWAI = ["Dosen", "Tendik", "Akademisi Luar UM"] as const;
export type KelompokPegawai = (typeof KELOMPOK_PEGAWAI)[number];

export const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export function namaBulan(bulan: number): string {
  return NAMA_BULAN[bulan - 1] ?? `Bulan ${bulan}`;
}
