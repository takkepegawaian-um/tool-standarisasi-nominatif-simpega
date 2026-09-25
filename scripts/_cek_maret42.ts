import { prisma } from "../lib/db";

async function main() {
  const mar = await prisma.uploadBatch.findFirst({ where: { bulan: 3, tahun: 2026 } });
  const rows = await prisma.barisBermasalah.findMany({
    where: { uploadBatchId: mar!.id, status: "Menunggu" },
    orderBy: { alasanUtama: "asc" },
  });
  console.log("Total:", rows.length);

  const byAlasan: Record<string, number> = {};
  for (const r of rows) byAlasan[r.alasanUtama] = (byAlasan[r.alasanUtama] ?? 0) + 1;
  console.log("Breakdown:", byAlasan);

  console.log("\nDetail semua baris:");
  for (const r of rows) {
    const raw = r.dataMentah as any;
    console.log(r.alasanUtama, "|", r.nip, "|", raw.namaTanpaGelar || raw.namaDenganGelar || "(tanpa nama)", "|", r.detailAlasan.slice(0, 150));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
