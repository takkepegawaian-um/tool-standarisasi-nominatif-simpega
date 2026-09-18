import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { generateNominatifExport } from "@/lib/excel/exportNominatif";
import { namaBulan } from "@/lib/constants";

// Digenerate ulang dari DB tiap request (bukan di-cache ke disk) - filesystem serverless Vercel
// read-only/ephemeral di luar /tmp, dan generate-nya sendiri murah (baca DB + isi template).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const batch = await prisma.uploadBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });

  const buffer = await generateNominatifExport(id);
  const filename = `Nominatif_Bulanan_${namaBulan(batch.bulan)}${batch.tahun}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
