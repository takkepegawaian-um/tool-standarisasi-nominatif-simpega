# Tool Standardisasi Nominatif Pegawai — SIMPEGA UM

Aplikasi internal untuk merapikan export mentah bulanan SIMPEGA ("DataPNSPTT_[Bulan][Tahun].xlsx",
85+ kolom, header duplikat) menjadi file `Nominatif Bulanan` siap-upload ke aplikasi SIMPEGA UM
(`Template_Upload_Nominatif_Bulanan_SIMPEGA_UM.xlsx`, ada di `docs/referensi/`). Proyek ini
terpisah dari repo Laravel SIMPEGA UM — lihat `Skema_Database_SIMPEGA_UM.md` di repo itu untuk
skema master data yang jadi rujukan di sini.

## Stack

Next.js 15 (App Router, TypeScript) · Prisma + SQLite (dev) — ganti ke Postgres untuk produksi ·
Tailwind CSS · NextAuth (Credentials, 1 akun admin) · exceljs.

## Setup

```bash
npm install
cp .env.example .env      # isi AUTH_SECRET, lihat komentar di file
npx prisma migrate dev
npx prisma db seed        # seed master data (dari prisma/seed-data/*.json) + akun admin
npm run dev
```

Login default: `admin@simpega.um.ac.id` / `kdsone` (ganti setelah setup awal).

## Alur

1. **Upload** (`/upload`) — pilih bulan/tahun, upload 1 file export mentah SIMPEGA.
2. Sistem parse sheet "Nominatif", klasifikasikan tiap baris (Dosen/Tendik/Akademisi Luar UM)
   dan petakan ke master data — **hanya pencocokan deterministik** (exact/prefix), tidak pernah
   menebak. Baris yang gagal dipetakan yakin masuk antrean **Review** (`/batch/[id]/review`).
3. Menyelesaikan satu baris bermasalah bisa dicentang "ingat untuk bulan berikutnya" — nilai
   mentah yang sama otomatis ter-resolve di **upload bulan berikutnya** (lihat `/kamus`), bukan
   retroaktif ke baris lain di bulan yang sama.
4. Setelah semua baris beres, unduh file `Nominatif Bulanan` (`/batch/[id]/export`) untuk
   diupload manual ke SIMPEGA. Arsip semua bulan yang selesai ada di `/arsip`.

## Keputusan desain penting

- **Master data di-seed dari database Laravel `sistem_kepegawaian_um` yang sudah live**
  (`prisma/seed-data/*.json`), bukan dari file Excel draft — supaya nama/kode persis cocok
  dengan yang divalidasi SIMPEGA saat file hasil tool ini diupload ke sana.
- **Parsing kolom berdasar nama header + urutan kemunculan**, bukan indeks kolom tetap — posisi
  kolom terbukti berubah antar bulan (lihat `lib/excel/columnMap.ts`). Validasi "anchor" akan
  menolak seluruh file dengan pesan jelas kalau struktur berubah drastis, bukan menebak.
- **Tidak ada fuzzy-matching otomatis** di manapun (lihat `lib/domain/matching.ts` dan
  `lib/domain/classify.ts`) — hanya exact/prefix match ke master data + kamus koreksi.

## Keterbatasan v1 / follow-up yang belum dikerjakan

- **Jabatan Tambahan (slot 1 & 2) belum diisi otomatis dari file mentah.** Skema (`prisma/schema.prisma`,
  model `NominatifBulananJabatanTambahan`) dan kolom di file ekspor sudah siap, tapi
  `importBatch`/`resolveRow` belum mem-parsing & mencocokkan kolom "Jabatan Tambahan" mentah
  (raw-nya menggabungkan nama role + unit dalam 1 sel, dan sumber tidak punya info Status
  Pengangkatan sama sekali) — perlu dirancang alur resolusi manual terpisah.
- **Database produksi (Postgres) belum disiapkan** — jalan di SQLite untuk dev. Ganti
  `provider` di `prisma/schema.prisma` dari `sqlite` ke `postgresql` dan `DATABASE_URL` di
  `.env`, lalu `prisma migrate deploy`, sebelum deploy (rekomendasi: Neon, native ke Vercel).
- **Proses upload berjalan sinkron** dalam 1 request (~1-3 menit untuk ~2.400 baris di SQLite
  lokal) — perlu dites lagi timeout-nya di lingkungan produksi (mis. batas durasi function
  Vercel) sebelum deploy; kalau perlu, pindahkan ke background job.
- Backfill Januari–September 2026 belum dijalankan — dilakukan manual oleh admin lewat `/upload`
  satu per satu (`scripts/test-import.ts` bisa dipakai lewat CLI sebagai alternatif kalau perlu).
