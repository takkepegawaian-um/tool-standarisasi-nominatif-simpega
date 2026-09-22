import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { classifyRow, pilihAlasanUtama } from "@/lib/domain/classify";
import type { ResolvedNominatif } from "@/lib/domain/classify";
import { loadKamusMap, loadMasterCache } from "@/lib/domain/masterCache";
import { parseRawNominatif } from "@/lib/excel/parseRawNominatif";
import type { RawNominatifRow } from "@/lib/excel/types";

export type ImportBatchResult = {
  uploadBatchId: string;
  jumlahBarisTotal: number;
  jumlahBerhasil: number;
  jumlahPerluReview: number;
};

type NominatifRow = Omit<ResolvedNominatif, "jabatanTambahan"> & {
  id: string;
  pegawaiNip: string;
};
type JabatanTambahanRow = NonNullable<ResolvedNominatif["jabatanTambahan"]> & {
  nominatifBulananId: string;
};
type BarisBermasalahRow = {
  nip: string;
  dataMentah: ReturnType<typeof toDataMentah>;
  alasanUtama: string;
  detailAlasan: string;
};

/**
 * Field mentah yang relevan ke skema nominatif saja yang disimpan sebagai `dataMentah` -
 * NIK/KK/rekening/alamat/dll dari file sumber TIDAK PERNAH masuk RawNominatifRow sejak parsing
 * (lihat lib/excel/parseRawNominatif.ts), jadi sanitasi ini otomatis by construction.
 */
function toDataMentah(row: RawNominatifRow) {
  return {
    ...row,
    tanggalLahir: row.tanggalLahir?.toISOString() ?? null,
    tanggalMasuk: row.tanggalMasuk?.toISOString() ?? null,
  };
}

export async function importBatch(
  fileBuffer: Buffer,
  namaFileAsli: string,
  bulan: number,
  tahun: number,
  diunggahOlehId: string
): Promise<ImportBatchResult> {
  const { rows, petaKolomTerdeteksi } = await parseRawNominatif(fileBuffer);
  const [master, kamus] = await Promise.all([loadMasterCache(), loadKamusMap()]);

  // Klasifikasi semua baris dulu di memori (tidak ada query DB sama sekali di sini) - hasilnya
  // baru ditulis ke DB lewat beberapa query BULK saja, terlepas dari jumlah baris. Sebelumnya
  // tiap baris di-upsert satu-satu (~2-3 round-trip/baris, ribuan round-trip utk 1 file) -
  // di produksi (function & DB beda region/latensi lebih tinggi) ini gampang lewat batas durasi
  // function Vercel meski sudah dibungkus 1 transaksi.
  const nominatifRows: NominatifRow[] = [];
  const jabatanTambahanRows: JabatanTambahanRow[] = [];
  const barisBermasalahRows: BarisBermasalahRow[] = [];

  for (const row of rows) {
    const result = classifyRow(row, master, kamus);
    if (result.ok) {
      const { jabatanTambahan, ...nominatifData } = result.data;
      const id = randomUUID();
      nominatifRows.push({ id, pegawaiNip: row.nip, ...nominatifData });
      if (jabatanTambahan) {
        jabatanTambahanRows.push({ nominatifBulananId: id, ...jabatanTambahan });
      }
    } else {
      barisBermasalahRows.push({
        nip: row.nip,
        dataMentah: toDataMentah(row),
        alasanUtama: pilihAlasanUtama(result.issues),
        detailAlasan: result.issues.map((i) => i.detail).join(" | "),
      });
    }
  }

  const jumlahBerhasil = nominatifRows.length;
  const jumlahPerluReview = barisBermasalahRows.length;
  const status = jumlahPerluReview === 0 ? "Selesai" : "MenungguReview";

  const batchId = await prisma.$transaction(
    async (tx) => {
      const batch = await tx.uploadBatch.create({
        data: {
          bulan,
          tahun,
          namaFileAsli,
          status,
          jumlahBarisTotal: rows.length,
          jumlahBerhasil,
          jumlahPerluReview,
          diunggahOlehId,
          petaKolomTerdeteksi,
        },
      });

      // Upload bulanan mencerminkan SELURUH pegawai aktif bulan itu (aturan bisnis) - kalau ini
      // upload ulang utk bulan/tahun yang sama, snapshot lama utk bulan itu diganti total oleh
      // yang baru (cascade otomatis hapus jabatan tambahan anaknya).
      await tx.nominatifBulanan.deleteMany({ where: { bulan, tahun } });

      if (nominatifRows.length > 0) {
        const uniqueNips = [...new Set(nominatifRows.map((r) => r.pegawaiNip))];
        await tx.pegawai.createMany({
          data: uniqueNips.map((nip) => ({ nip })),
          skipDuplicates: true,
        });

        await tx.nominatifBulanan.createMany({
          data: nominatifRows.map((r) => ({ ...r, bulan, tahun, uploadBatchId: batch.id })),
        });

        if (jabatanTambahanRows.length > 0) {
          await tx.nominatifBulananJabatanTambahan.createMany({ data: jabatanTambahanRows });
        }
      }

      if (barisBermasalahRows.length > 0) {
        await tx.barisBermasalah.createMany({
          data: barisBermasalahRows.map((r) => ({ ...r, uploadBatchId: batch.id })),
        });
      }

      return batch.id;
    },
    { timeout: 5 * 60 * 1000 }
  );

  return {
    uploadBatchId: batchId,
    jumlahBarisTotal: rows.length,
    jumlahBerhasil,
    jumlahPerluReview,
  };
}
