-- CreateTable
CREATE TABLE "mst_jenis_pegawai" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "keterangan" TEXT
);

-- CreateTable
CREATE TABLE "mst_status_kepegawaian" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "kategori" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "mst_golongan" (
    "kode" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "mst_jabatan_fungsional_dosen" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "urutanJenjang" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "mst_jabatan_fungsional_tendik" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "jabatanPokok" TEXT NOT NULL,
    "jenjang" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "mst_jabatan_fungsi_umum_pelaksana" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "mst_jabatan_tambahan_role" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "namaRole" TEXT NOT NULL,
    "berlakuUntuk" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "mst_unit_induk" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "mst_unit_asal" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "unitIndukKode" TEXT NOT NULL,
    CONSTRAINT "mst_unit_asal_unitIndukKode_fkey" FOREIGN KEY ("unitIndukKode") REFERENCES "mst_unit_induk" ("kode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mst_program_studi" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "jenjang" TEXT NOT NULL,
    "unitAsalKode" TEXT NOT NULL,
    "statusValidasi" TEXT NOT NULL,
    CONSTRAINT "mst_program_studi_unitAsalKode_fkey" FOREIGN KEY ("unitAsalKode") REFERENCES "mst_unit_asal" ("kode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mst_kategori_akademisi_luar" (
    "kode" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "masukRekapKehadiran" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "pegawai" (
    "nip" TEXT NOT NULL PRIMARY KEY,
    "dibuatPada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "dibuatPada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "upload_batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "namaFileAsli" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Diproses',
    "jumlahBarisTotal" INTEGER NOT NULL DEFAULT 0,
    "jumlahBerhasil" INTEGER NOT NULL DEFAULT 0,
    "jumlahPerluReview" INTEGER NOT NULL DEFAULT 0,
    "petaKolomTerdeteksi" JSONB,
    "fileExportPath" TEXT,
    "diunggahOlehId" TEXT NOT NULL,
    "diunggahPada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "upload_batch_diunggahOlehId_fkey" FOREIGN KEY ("diunggahOlehId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "baris_bermasalah" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadBatchId" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "dataMentah" JSONB NOT NULL,
    "alasanUtama" TEXT NOT NULL,
    "detailAlasan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Menunggu',
    "resolvedFields" JSONB,
    "diselesaikanOlehId" TEXT,
    "diselesaikanPada" DATETIME,
    "dibuatPada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "baris_bermasalah_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "upload_batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "baris_bermasalah_diselesaikanOlehId_fkey" FOREIGN KEY ("diselesaikanOlehId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kamus_koreksi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jenisField" TEXT NOT NULL,
    "kunciMentah" TEXT NOT NULL,
    "nilaiResolusi" TEXT NOT NULL,
    "catatan" TEXT,
    "dibuatOlehId" TEXT NOT NULL,
    "dibuatPada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kamus_koreksi_dibuatOlehId_fkey" FOREIGN KEY ("dibuatOlehId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitasId" TEXT NOT NULL,
    "detail" JSONB,
    "dilakukanOlehId" TEXT NOT NULL,
    "dilakukanPada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_dilakukanOlehId_fkey" FOREIGN KEY ("dilakukanOlehId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nominatif_bulanan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pegawaiNip" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "jenisKelamin" TEXT NOT NULL,
    "tanggalLahir" DATETIME NOT NULL,
    "pendidikanTerakhir" TEXT,
    "agama" TEXT,
    "jenisPegawaiKode" TEXT NOT NULL,
    "statusKepegawaianKode" TEXT NOT NULL,
    "golonganKode" TEXT,
    "jabatanFungsionalDosenKode" TEXT,
    "jabatanFungsionalTendikKode" TEXT,
    "jabatanFungsiUmumKode" TEXT,
    "kategoriAkademisiLuarKode" TEXT,
    "unitAsalKode" TEXT NOT NULL,
    "tanggalMulaiKerja" DATETIME NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "dibuatPada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nominatif_bulanan_pegawaiNip_fkey" FOREIGN KEY ("pegawaiNip") REFERENCES "pegawai" ("nip") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_jenisPegawaiKode_fkey" FOREIGN KEY ("jenisPegawaiKode") REFERENCES "mst_jenis_pegawai" ("kode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_statusKepegawaianKode_fkey" FOREIGN KEY ("statusKepegawaianKode") REFERENCES "mst_status_kepegawaian" ("kode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_golonganKode_fkey" FOREIGN KEY ("golonganKode") REFERENCES "mst_golongan" ("kode") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_jabatanFungsionalDosenKode_fkey" FOREIGN KEY ("jabatanFungsionalDosenKode") REFERENCES "mst_jabatan_fungsional_dosen" ("kode") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_jabatanFungsionalTendikKode_fkey" FOREIGN KEY ("jabatanFungsionalTendikKode") REFERENCES "mst_jabatan_fungsional_tendik" ("kode") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_jabatanFungsiUmumKode_fkey" FOREIGN KEY ("jabatanFungsiUmumKode") REFERENCES "mst_jabatan_fungsi_umum_pelaksana" ("kode") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_kategoriAkademisiLuarKode_fkey" FOREIGN KEY ("kategoriAkademisiLuarKode") REFERENCES "mst_kategori_akademisi_luar" ("kode") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_unitAsalKode_fkey" FOREIGN KEY ("unitAsalKode") REFERENCES "mst_unit_asal" ("kode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "upload_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nominatif_bulanan_jabatan_tambahan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nominatifBulananId" TEXT NOT NULL,
    "jabatanTambahanRoleKode" TEXT NOT NULL,
    "unitAsalKode" TEXT,
    "programStudiKode" TEXT,
    "statusPengangkatan" TEXT NOT NULL,
    CONSTRAINT "nominatif_bulanan_jabatan_tambahan_nominatifBulananId_fkey" FOREIGN KEY ("nominatifBulananId") REFERENCES "nominatif_bulanan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_jabatan_tambahan_jabatanTambahanRoleKode_fkey" FOREIGN KEY ("jabatanTambahanRoleKode") REFERENCES "mst_jabatan_tambahan_role" ("kode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_jabatan_tambahan_unitAsalKode_fkey" FOREIGN KEY ("unitAsalKode") REFERENCES "mst_unit_asal" ("kode") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "nominatif_bulanan_jabatan_tambahan_programStudiKode_fkey" FOREIGN KEY ("programStudiKode") REFERENCES "mst_program_studi" ("kode") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "kamus_koreksi_jenisField_kunciMentah_key" ON "kamus_koreksi"("jenisField", "kunciMentah");

-- CreateIndex
CREATE UNIQUE INDEX "nominatif_bulanan_pegawaiNip_bulan_tahun_key" ON "nominatif_bulanan"("pegawaiNip", "bulan", "tahun");
