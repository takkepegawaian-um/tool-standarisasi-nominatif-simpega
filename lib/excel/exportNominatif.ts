import path from "node:path";

import ExcelJS from "exceljs";

import { prisma } from "@/lib/db";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "docs/referensi/Template_Upload_Nominatif_Bulanan_SIMPEGA_UM.xlsx"
);
const SHEET_NAME = "Nominatif Bulanan";

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function namaJabatan(row: {
  jabatanFungsionalDosen: { nama: string } | null;
  jabatanFungsionalTendik: { jabatanPokok: string; jenjang: string } | null;
  jabatanFungsiUmum: { nama: string } | null;
}): string {
  if (row.jabatanFungsionalDosen) return row.jabatanFungsionalDosen.nama;
  if (row.jabatanFungsionalTendik) {
    const { jabatanPokok, jenjang } = row.jabatanFungsionalTendik;
    return jenjang === "-" ? jabatanPokok : `${jabatanPokok} ${jenjang}`;
  }
  if (row.jabatanFungsiUmum) return row.jabatanFungsiUmum.nama;
  return "";
}

export async function generateNominatifExport(uploadBatchId: string): Promise<Buffer> {
  const rows = await prisma.nominatifBulanan.findMany({
    where: { uploadBatchId },
    orderBy: { nama: "asc" },
    include: {
      jenisPegawai: true,
      statusKepegawaian: true,
      golongan: true,
      jabatanFungsionalDosen: true,
      jabatanFungsionalTendik: true,
      jabatanFungsiUmum: true,
      kategoriAkademisiLuar: true,
      unitAsal: true,
      jabatanTambahan: { include: { jabatanTambahanRole: true, unitAsal: true, programStudi: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan di template ekspor.`);

  // Baris contoh/catatan bawaan template (baris 2 dst) DITIMPA langsung, bukan dihapus dulu -
  // `spliceRows` exceljs punya bug off-by-one saat count-nya pas mencapai baris terakhir sheet
  // (rentang yang mau dihapus sama persis dengan sisa baris template disini) sehingga
  // tidak menghapus apa pun. Menimpa nilai per-baris langsung menghindari bug itu sekaligus
  // lebih sederhana.
  const originalLastRow = sheet.rowCount;

  rows.forEach((row, idx) => {
    const slot1 = row.jabatanTambahan[0];
    const slot2 = row.jabatanTambahan[1];

    sheet.getRow(idx + 2).values = [
      row.pegawaiNip,
      row.nama,
      row.jenisKelamin,
      fmtDate(row.tanggalLahir),
      row.pendidikanTerakhir ?? "",
      row.agama ?? "",
      row.jenisPegawai.nama,
      row.statusKepegawaian.nama,
      row.golongan?.kode ?? "",
      namaJabatan(row),
      row.kategoriAkademisiLuar?.nama ?? "",
      row.unitAsal.nama,
      fmtDate(row.tanggalMulaiKerja),
      slot1?.jabatanTambahanRole.namaRole ?? "",
      slot1?.unitAsal?.nama ?? slot1?.programStudi?.nama ?? "",
      slot1?.statusPengangkatan ?? "",
      slot2?.jabatanTambahanRole.namaRole ?? "",
      slot2?.unitAsal?.nama ?? slot2?.programStudi?.nama ?? "",
      slot2?.statusPengangkatan ?? "",
    ];
  });

  // Kalau data lebih pendek dari template asli (jarang di produksi, tapi bisa terjadi saat
  // testing), bersihkan sisa baris contoh/catatan yang belum ketimpa.
  for (let r = rows.length + 2; r <= originalLastRow; r++) {
    sheet.getRow(r).values = [];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
