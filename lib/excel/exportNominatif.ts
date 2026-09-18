import path from "node:path";

import ExcelJS from "exceljs";

import { prisma } from "@/lib/db";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "docs/referensi/Template_Upload_Nominatif_Bulanan_SIMPEGA_UM.xlsx"
);
const SHEET_NAME = "Nominatif Bulanan";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

  // Buang baris contoh/catatan bawaan template (baris 2 dst), sisakan header baris 1.
  if (sheet.rowCount > 1) {
    sheet.spliceRows(2, sheet.rowCount - 1);
  }

  for (const row of rows) {
    const slot1 = row.jabatanTambahan[0];
    const slot2 = row.jabatanTambahan[1];

    sheet.addRow([
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
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
