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

  // Template resmi cuma punya 2 blok Jabatan Tambahan (kolom 14-19). Blok ke-3 (kolom 20-22) dan
  // "Catatan (Bandingkan Batch)" (kolom 23) ditambah SETELAHNYA saat generate, gaya header disalin
  // dari kolom 19 supaya seragam. Kolom 1-19 TIDAK berubah. KDS2 membaca kolom BY NAMA header.
  const headerBaru: [number, string, number][] = [
    [20, "Jabatan Tambahan 3", 20],
    [21, "Unit/Prodi Jabatan Tambahan 3", 22],
    [22, "Status Pengangkatan 3", 14],
    [23, "Catatan (Bandingkan Batch)", 30],
  ];
  const sel19 = sheet.getRow(1).getCell(19);
  for (const [kolom, teks, lebar] of headerBaru) {
    const sel = sheet.getRow(1).getCell(kolom);
    sel.value = teks;
    sel.style = { ...sel19.style };
    sheet.getColumn(kolom).width = lebar;
  }

  // Lembar "Petunjuk Pengisian" menyebut "1 & 2" - sesuaikan teksnya ke 3 slot (best-effort).
  const petunjuk = workbook.getWorksheet("Petunjuk Pengisian");
  petunjuk?.eachRow((r) => {
    const sel = r.getCell(1);
    if (typeof sel.value === "string" && /^(Unit\/Prodi )?(Jabatan Tambahan|Status Pengangkatan) 1 & 2$/.test(sel.value)) {
      sel.value = sel.value.replace("1 & 2", "1, 2 & 3");
    }
    const ket = r.getCell(4);
    if (typeof ket.value === "string" && ket.value.includes("Slot ke-2 untuk kasus rangkap 2 jabatan")) {
      ket.value = ket.value.replace("Slot ke-2 untuk kasus rangkap 2 jabatan", "Slot ke-2 dan ke-3 untuk kasus rangkap 2-3 jabatan");
    }
  });

  // Baris contoh/catatan bawaan template (baris 2 dst) DITIMPA langsung, bukan dihapus dulu -
  // `spliceRows` exceljs punya bug off-by-one saat count-nya pas mencapai baris terakhir sheet
  // (rentang yang mau dihapus sama persis dengan sisa baris template disini) sehingga
  // tidak menghapus apa pun. Menimpa nilai per-baris langsung menghindari bug itu sekaligus
  // lebih sederhana.
  const originalLastRow = sheet.rowCount;

  rows.forEach((row, idx) => {
    const slot1 = row.jabatanTambahan[0];
    const slot2 = row.jabatanTambahan[1];
    const slot3 = row.jabatanTambahan[2];

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
      slot3?.jabatanTambahanRole.namaRole ?? "",
      slot3?.unitAsal?.nama ?? slot3?.programStudi?.nama ?? "",
      slot3?.statusPengangkatan ?? "",
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
