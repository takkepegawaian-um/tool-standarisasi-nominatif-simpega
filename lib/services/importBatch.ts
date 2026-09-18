import { prisma } from "@/lib/db";
import { classifyRow, pilihAlasanUtama } from "@/lib/domain/classify";
import { loadKamusMap, loadMasterCache } from "@/lib/domain/masterCache";
import { parseRawNominatif } from "@/lib/excel/parseRawNominatif";
import type { RawNominatifRow } from "@/lib/excel/types";

export type ImportBatchResult = {
  uploadBatchId: string;
  jumlahBarisTotal: number;
  jumlahBerhasil: number;
  jumlahPerluReview: number;
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

  // Seluruh proses dibungkus 1 transaksi - ribuan write terpisah tanpa transaksi sangat lambat
  // di SQLite (tiap query auto-commit sendiri) dan berisiko batch "setengah jadi" kalau proses
  // gagal di tengah jalan.
  const batchId = await prisma.$transaction(
    async (tx) => {
      const batch = await tx.uploadBatch.create({
        data: {
          bulan,
          tahun,
          namaFileAsli,
          status: "Diproses",
          jumlahBarisTotal: rows.length,
          diunggahOlehId,
          petaKolomTerdeteksi,
        },
      });

      let jumlahBerhasil = 0;
      let jumlahPerluReview = 0;

      for (const row of rows) {
        const result = classifyRow(row, master, kamus);

        if (result.ok) {
          await tx.pegawai.upsert({
            where: { nip: row.nip },
            create: { nip: row.nip },
            update: {},
          });
          await tx.nominatifBulanan.upsert({
            where: { pegawaiNip_bulan_tahun: { pegawaiNip: row.nip, bulan, tahun } },
            create: { pegawaiNip: row.nip, bulan, tahun, uploadBatchId: batch.id, ...result.data },
            update: { uploadBatchId: batch.id, ...result.data },
          });
          jumlahBerhasil++;
        } else {
          await tx.barisBermasalah.create({
            data: {
              uploadBatchId: batch.id,
              nip: row.nip,
              dataMentah: toDataMentah(row),
              alasanUtama: pilihAlasanUtama(result.issues),
              detailAlasan: result.issues.map((i) => i.detail).join(" | "),
            },
          });
          jumlahPerluReview++;
        }
      }

      const status = jumlahPerluReview === 0 ? "Selesai" : "MenungguReview";
      await tx.uploadBatch.update({
        where: { id: batch.id },
        data: { jumlahBerhasil, jumlahPerluReview, status },
      });

      return batch.id;
    },
    { timeout: 5 * 60 * 1000 }
  );

  const final = await prisma.uploadBatch.findUniqueOrThrow({ where: { id: batchId } });

  return {
    uploadBatchId: final.id,
    jumlahBarisTotal: final.jumlahBarisTotal,
    jumlahBerhasil: final.jumlahBerhasil,
    jumlahPerluReview: final.jumlahPerluReview,
  };
}
