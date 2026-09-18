import { writeFile } from "node:fs/promises";

import { prisma } from "../lib/db";
import { generateNominatifExport } from "../lib/excel/exportNominatif";

async function main() {
  const batch = await prisma.uploadBatch.findFirst({ orderBy: { diunggahPada: "desc" } });
  if (!batch) throw new Error("Tidak ada batch.");

  const buffer = await generateNominatifExport(batch.id);
  await writeFile("test-export-output.xlsx", buffer);
  console.log("Export ditulis ke test-export-output.xlsx, ukuran:", buffer.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
