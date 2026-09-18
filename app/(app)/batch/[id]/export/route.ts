import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { generateNominatifExport } from "@/lib/excel/exportNominatif";
import { namaBulan } from "@/lib/constants";

const ARSIP_DIR = path.join(process.cwd(), "storage", "arsip");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const batch = await prisma.uploadBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });

  let buffer: Buffer;
  if (batch.fileExportPath && existsSync(batch.fileExportPath)) {
    buffer = await readFile(batch.fileExportPath);
  } else {
    buffer = await generateNominatifExport(id);
    await mkdir(ARSIP_DIR, { recursive: true });
    const filePath = path.join(ARSIP_DIR, `${id}.xlsx`);
    await writeFile(filePath, buffer);
    await prisma.uploadBatch.update({ where: { id }, data: { fileExportPath: filePath } });
  }

  const filename = `Nominatif_Bulanan_${namaBulan(batch.bulan)}${batch.tahun}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
