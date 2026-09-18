/**
 * Dev helper: jalankan importBatch langsung dari CLI tanpa lewat UI, berguna untuk cek cepat
 * hasil klasifikasi sebuah file mentah tanpa perlu upload manual berulang kali saat development.
 *
 * Pemakaian: npx tsx scripts/test-import.ts <path-file.xlsx> <bulan 1-12> <tahun>
 */
import { readFile } from "node:fs/promises";

import { prisma } from "../lib/db";
import { importBatch } from "../lib/services/importBatch";

async function main() {
  const [filePath, bulanArg, tahunArg] = process.argv.slice(2);
  if (!filePath || !bulanArg || !tahunArg) {
    console.error("Pemakaian: npx tsx scripts/test-import.ts <path-file.xlsx> <bulan> <tahun>");
    process.exit(1);
  }

  const buffer = await readFile(filePath);
  const admin = await prisma.user.findFirstOrThrow();

  const result = await importBatch(buffer, filePath, Number(bulanArg), Number(tahunArg), admin.id);
  console.log("Hasil import:", result);

  const breakdown = await prisma.barisBermasalah.groupBy({
    by: ["alasanUtama"],
    where: { uploadBatchId: result.uploadBatchId },
    _count: { _all: true },
  });
  console.log("Breakdown alasan review:", breakdown);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
