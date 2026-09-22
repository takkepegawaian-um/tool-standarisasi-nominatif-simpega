# Tool Standardisasi Nominatif Pegawai — SIMPEGA UM

Aplikasi internal untuk merapikan export mentah bulanan SIMPEGA ("DataPNSPTT_[Bulan][Tahun].xlsx",
85+ kolom, header duplikat) menjadi file `Nominatif Bulanan` siap-upload ke aplikasi SIMPEGA UM
(`Template_Upload_Nominatif_Bulanan_SIMPEGA_UM.xlsx`, ada di `docs/referensi/`). Proyek ini
terpisah dari repo Laravel SIMPEGA UM — lihat `Skema_Database_SIMPEGA_UM.md` di repo itu untuk
skema master data yang jadi rujukan di sini.

## Stack

Next.js 15 (App Router, TypeScript) · Prisma + Postgres · Tailwind CSS ·
NextAuth (Credentials, 1 akun admin) · exceljs.

## Setup (dev lokal)

Butuh 1 database Postgres (mis. branch/database terpisah dari Postgres produksi - lihat bagian
Deploy di bawah untuk cara membuatnya lewat Vercel).

```bash
npm install
cp .env.example .env      # isi DATABASE_URL & AUTH_SECRET, lihat komentar di file
npx prisma migrate dev
npx prisma db seed        # seed master data (dari prisma/seed-data/*.json) + akun admin
npm run dev
```

Login default: `admin@simpega.um.ac.id` / `kdsone` (ganti setelah setup awal).

## Deploy (Vercel + Postgres bawaan Vercel)

1. Di dashboard Vercel: **Add New... > Project**, import repo GitHub ini.
2. Di project yang baru dibuat: tab **Storage > Create Database > Postgres** (Neon di
   baliknya) - integrasi ini otomatis menambahkan beberapa environment variable, termasuk
   `DATABASE_URL` (pooled, dipakai runtime) dan `DATABASE_URL_UNPOOLED` (dipakai Prisma migrate
   lewat `directUrl` di `prisma/schema.prisma`) - keduanya harus ada persis dengan nama itu.
3. Tab **Settings > Environments > Production** (atau **Environment Variables** di versi UI
   lama): tambahkan `AUTH_SECRET` (generate baru, JANGAN pakai yang sama dengan `.env` lokal -
   lihat komentar di `.env.example`).
4. Deploy. Build script (`package.json`) otomatis menjalankan `prisma migrate deploy` +
   `prisma db seed` sebelum `next build`, jadi skema & master data + akun admin ter-setup
   otomatis di database baru pada deploy pertama.
5. Login pakai `admin@simpega.um.ac.id` / `kdsone`, **segera ganti password** setelah login
   pertama (belum ada UI ganti password di v1 - lakukan lewat `prisma studio` atau query
   manual: hash baru dengan bcrypt, update kolom `passwordHash` di tabel `user`).

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
- **Jabatan Tambahan** (role + unit/prodi + status pengangkatan, slot 1) diekstrak dari 1 sel
  mentah yang menggabungkan nama role & unit tanpa pemisah konsisten (`lib/domain/classify.ts`,
  `pisahJabatanTambahanRaw` — mencoba tiap nama role master sebagai kandidat awalan, tervalidasi
  cuma kalau sisanya PERSIS cocok nama Unit Asal/Program Studi). Status Pengangkatan
  (Definitif/Plt/Pjs) tidak pernah ada sinyalnya di sumber KECUALI teks diawali "Plt."/"Pjs."
  eksplisit — selain itu selalu perlu resolusi manual sekali lalu diingat lewat kamus koreksi.
  Slot ke-2 tidak pernah diisi otomatis (sumber cuma punya 1 kolom jabatan tambahan).

## Keterbatasan v1 / follow-up yang belum dikerjakan

- **Proses upload berjalan sinkron** dalam 1 request (~1-3 menit untuk ~2.400 baris) -
  `app/(app)/layout.tsx` set `maxDuration = 300` supaya cocok untuk Vercel Pro (atau Hobby
  dengan Fluid Compute), tapi **Vercel Hobby plan biasa hard-cap di 60 detik terlepas dari
  config ini** - kalau upload timeout di Hobby, satu-satunya jalan adalah pindahkan proses
  import ke background job (queue/worker terpisah), bukan sekadar naikkan angka config.
- **Belum ada UI ganti password** - password admin awal (`kdsone`) diganti manual lewat
  `prisma studio` atau query langsung (hash baru dengan bcrypt, update kolom `passwordHash` di
  tabel `user`). Prioritaskan ini segera setelah deploy pertama.
- Backfill Januari–September 2026 belum dijalankan — dilakukan manual oleh admin lewat `/upload`
  satu per satu (`scripts/test-import.ts` bisa dipakai lewat CLI sebagai alternatif kalau perlu).
