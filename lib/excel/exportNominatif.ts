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

  // Catatan dari fitur Bandingkan Batch (lihat app/(app)/bandingkan) - MURNI informasi tambahan
  // utk admin KDS2, bukan bagian kontrak resmi SIMPEGA (template 19 kolom tidak diubah, kolom ini
  // ditambah SETELAHNYA, kolom ke-20). "Baru" diutamakan drpd "Anomali" krn lebih relevan utk
  // roster bulan ini (jelaskan kenapa orang itu baru muncul); kalau cuma ada catatan Anomali
  // (mis. "Duplikat - NIP berubah"), itu dipakai sbg fallback.
  const catatanRows = await prisma.catatanPerubahanBatch.findMany({
    where: { nipUtama: { in: rows.map((r) => r.pegawaiNip) }, kategori: { in: ["Baru", "Anomali"] } },
  });
  const catatanPerNip = new Map<string, string>();
  for (const c of catatanRows) {
    if (c.kategori === "Baru" || !catatanPerNip.has(c.nipUtama)) {
      catatanPerNip.set(c.nipUtama, c.alasan);
    }
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan di template ekspor.`);

  sheet.getRow(1).getCell(20).value = "Catatan (Bandingkan Batch)";

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
      catatanPerNip.get(row.pegawaiNip) ?? "",
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
