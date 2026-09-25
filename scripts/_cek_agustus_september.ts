import { prisma } from "../lib/db";

async function cekBulan(bulan: number, tahun: number) {
  const batch = await prisma.uploadBatch.findFirst({ where: { bulan, tahun } });
  const rows = await prisma.barisBermasalah.findMany({
    where: { uploadBatchId: batch!.id, status: "Menunggu" },
    orderBy: { alasanUtama: "asc" },
  });
  console.log(`\n=== ${bulan}/${tahun} - Total: ${rows.length} ===`);
  const byAlasan: Record<string, number> = {};
  for (const r of rows) byAlasan[r.alasanUtama] = (byAlasan[r.alasanUtama] ?? 0) + 1;
  console.log("Breakdown:", byAlasan);

  for (const r of rows) {
    const raw = r.dataMentah as any;
    console.log(r.alasanUtama, "|", r.nip, "|", raw.namaTanpaGelar || raw.namaDenganGelar || "(tanpa nama)", "| Jenis:", raw.jenisPegawaiRaw, "Status:", raw.statusPegawaiRaw);
  }
}

async function main() {
  await cekBulan(8, 2026);
  await cekBulan(9, 2026);
}

main().catch(console.error).finally(() => prisma.$disconnect());
