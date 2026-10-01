import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { classifyRow, pilihAlasanUtama } from "@/lib/domain/classify";
import type { ResolvedNominatif } from "@/lib/domain/classify";
import {
  isNipPlaceholderTidakStabil,
  JENIS_FIELD_IDENTITAS_EKSTERNAL,
  kunciIdentitasEksternal,
} from "@/lib/domain/identitasEksternal";
import { loadKamusMap, loadMasterCache, loadNipDikecualikanPermanen, loadNipTerdaftar } from "@/lib/domain/masterCache";
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
type JabatanTambahanRow = ResolvedNominatif["jabatanTambahan"][number] & {
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
  const { rows: semuaRows, petaKolomTerdeteksi } = await parseRawNominatif(fileBuffer);
  const [master, kamus, nipTerdaftar, nipDikecualikanPermanen] = await Promise.all([
    loadMasterCache(),
    loadKamusMap(),
    loadNipTerdaftar(),
    loadNipDikecualikanPermanen(),
  ]);

  // NIP yang ditandai admin "jangan tampilkan lagi selamanya" (mis. sudah pensiun tapi file
  // sumber SIMPEGA masih menyertakannya) - di-skip TOTAL di sini, tidak ikut dihitung sbg baris
  // apapun (bukan berhasil, bukan juga perlu-review) - lihat loadNipDikecualikanPermanen.
  const rows = semuaRows.filter((r) => !nipDikecualikanPermanen.has(r.nip));

  // Klasifikasi semua baris dulu di memori (tidak ada query DB sama sekali di sini) - hasilnya
  // baru ditulis ke DB lewat beberapa query BULK saja, terlepas dari jumlah baris. Sebelumnya
  // tiap baris di-upsert satu-satu (~2-3 round-trip/baris, ribuan round-trip utk 1 file) -
  // di produksi (function & DB beda region/latensi lebih tinggi) ini gampang lewat batas durasi
  // function Vercel meski sudah dibungkus 1 transaksi.
  const nominatifRows: NominatifRow[] = [];
  const jabatanTambahanRows: JabatanTambahanRow[] = [];
  const barisBermasalahRows: BarisBermasalahRow[] = [];

  function prosesHasilClassify(
    rowAsli: RawNominatifRow,
    pegawaiNip: string,
    result: ReturnType<typeof classifyRow>
  ) {
    if (result.ok) {
      const { jabatanTambahan, ...nominatifData } = result.data;
      const id = randomUUID();
      nominatifRows.push({ id, pegawaiNip, ...nominatifData });
      for (const slot of jabatanTambahan) {
        jabatanTambahanRows.push({ nominatifBulananId: id, ...slot });
      }
    } else {
      barisBermasalahRows.push({
        nip: pegawaiNip,
        dataMentah: toDataMentah(rowAsli),
        alasanUtama: pilihAlasanUtama(result.issues),
        detailAlasan: result.issues.map((i) => i.detail).join(" | "),
      });
    }
  }

  for (const row of rows) {
    // NIP placeholder SIMPEGA (Akademisi Luar UM tanpa NIP asli) berubah tiap ekstraksi - lihat
    // lib/domain/identitasEksternal.ts. Resolusi identitas HARUS terjadi SEBELUM classifyRow,
    // karena beberapa kunci Kamus Koreksi (Klasifikasi, KategoriAkademisiLuar) sengaja berbasis
    // NIP - kalau classifyRow jalan duluan pakai NIP placeholder mentah, kamus-kamus itu juga ikut
    // "lupa" tiap bulan, bukan cuma pegawaiNip yang tersimpan.
    if (isNipPlaceholderTidakStabil(row.nip, bulan, tahun)) {
      const namaUntukIdentitas = row.namaDenganGelar || row.namaTanpaGelar;
      const kunci = kunciIdentitasEksternal(namaUntukIdentitas);
      const nipKanonik = kamus.get(`${JENIS_FIELD_IDENTITAS_EKSTERNAL}::${kunci}`);
      if (nipKanonik) {
        const rowEfektif = { ...row, nip: nipKanonik };
        prosesHasilClassify(row, nipKanonik, classifyRow(rowEfektif, master, kamus, nipTerdaftar));
      } else {
        // Nama ini belum pernah dikenali sebelumnya - JANGAN diklasifikasi otomatis sama sekali,
        // selalu masuk review manual dulu (admin tentukan: orang lama dgn NIP berubah, atau
        // benar pegawai baru) - lihat PilihIdentitasForm.tsx.
        barisBermasalahRows.push({
          nip: row.nip,
          dataMentah: toDataMentah(row),
          alasanUtama: "IdentitasEksternalPerluVerifikasi",
          detailAlasan: `NIP placeholder tidak stabil (dibuat SIMPEGA sendiri, bukan NIP asli) untuk "${namaUntukIdentitas}" - nama ini belum pernah dikenali sebelumnya, perlu verifikasi manual.`,
        });
      }
      continue;
    }

    prosesHasilClassify(row, row.nip, classifyRow(row, master, kamus, nipTerdaftar));
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

      // Batch LAMA utk bulan/tahun yang sama kehilangan SELURUH data nominatifnya oleh deleteMany
      // di atas, tapi row UploadBatch-nya sendiri sebelumnya dibiarkan apa adanya - status masih
      // "Selesai" dgn angka jumlahBerhasil lama yang jadi menyesatkan (kelihatan seperti batch
      // valid padahal datanya sudah 0). Ditemukan lewat fitur Bandingkan Batch. Tandai "Dibatalkan"
      // supaya jelas sudah ditimpa, tanpa menghapus baris itu sendiri (tetap jadi jejak audit
      // "pernah ada upload ini, kapan, oleh siapa").
      await tx.uploadBatch.updateMany({
        where: { bulan, tahun, id: { not: batch.id } },
        data: { status: "Dibatalkan" },
      });

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
