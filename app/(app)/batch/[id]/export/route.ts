import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateNominatifExport } from "@/lib/excel/exportNominatif";
import { namaBulan } from "@/lib/constants";

// Digenerate ulang dari DB tiap request (bukan di-cache ke disk) - filesystem serverless Vercel
// read-only/ephemeral di luar /tmp, dan generate-nya sendiri murah (baca DB + isi template).
//
// Route Handler TIDAK ikut dilindungi pengecekan login di app/(app)/layout.tsx (itu cuma
// berlaku utk Page lewat layout React, bukan Route Handler) - celah ini ditemukan saat
// membuat /bandingkan/export: siapa pun yang tahu/menebak batchId bisa unduh data PNS lengkap
// tanpa login sama sekali. Wajib cek auth() manual di sini.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

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
