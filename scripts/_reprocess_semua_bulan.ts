import * as fs from "fs";
import { prisma } from "../lib/db";
import { importBatch } from "../lib/services/importBatch";

const FILES: Array<{ bulan: number; tahun: number; path: string }> = [
  { bulan: 9, tahun: 2025, path: "D:/ANAS/bak/2025/DataPNSPTT_September2025.xlsx" },
  { bulan: 10, tahun: 2025, path: "D:/ANAS/bak/2025/DataPNSPTT_Oktober2025.xlsx" },
  { bulan: 11, tahun: 2025, path: "D:/ANAS/bak/2025/DataPNSPTT_November2025.xlsx" },
  { bulan: 12, tahun: 2025, path: "D:/ANAS/bak/2025/DataPNSPTT_Desember2025.xlsx" },
  { bulan: 1, tahun: 2026, path: "D:/ANAS/bak/2026/01 DataPNSPTT_Januari2026.xlsx" },
  { bulan: 2, tahun: 2026, path: "D:/ANAS/bak/2026/02 DataPNSPTT_Februari2026.xlsx" },
  { bulan: 3, tahun: 2026, path: "D:/ANAS/bak/2026/03 DataPNSPTT_Maret2026.xlsx" },
  { bulan: 4, tahun: 2026, path: "D:/ANAS/bak/2026/04 DataPNSPTT_April2026.xlsx" },
  { bulan: 5, tahun: 2026, path: "D:/ANAS/bak/2026/05 DataPNSPTT_Mei2026.xlsx" },
  { bulan: 6, tahun: 2026, path: "D:/ANAS/bak/2026/06 DataPNSPTT_Juni2026.xlsx" },
  { bulan: 7, tahun: 2026, path: "D:/ANAS/bak/2026/07 DataPNSPTT_Juli2026.xlsx" },
  { bulan: 8, tahun: 2026, path: "D:/ANAS/bak/2026/08 DataPNSPTT_Agustus2026.xlsx" },
  { bulan: 9, tahun: 2026, path: "D:/ANAS/bak/2026/09 DataPNSPTT_September2026.xlsx" },
];

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@simpega.um.ac.id" } });

  for (const f of FILES) {
    try {
      const buffer = fs.readFileSync(f.path);
      const result = await importBatch(buffer, f.path.split(/[//]/).pop()!, f.bulan, f.tahun, admin.id);
      console.log(`${f.bulan}/${f.tahun}: OK - berhasil=${result.jumlahBerhasil} review=${result.jumlahPerluReview} total=${result.jumlahBarisTotal}`);
    } catch (e) {
      console.log(`${f.bulan}/${f.tahun}: GAGAL -`, e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
