import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { generateBandingkanExport } from "@/lib/excel/exportBandingkan";
import { hitungPerbandinganBatch } from "@/lib/services/bandingkanBatchService";

// Route Handler TIDAK ikut dilindungi pengecekan login di app/(app)/layout.tsx (itu cuma
// berlaku utk Page lewat layout React) - jadi wajib cek auth() manual di sini juga, sama
// seperti /batch/[id]/export (lihat perbaikan di file itu juga).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  if (!a || !b) return NextResponse.json({ error: "Batch A dan B wajib diisi." }, { status: 400 });

  const hasil = await hitungPerbandinganBatch(a, b);
  if (!hasil) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });

  const buffer = await generateBandingkanExport(hasil);
  const filename = `Bandingkan_${hasil.labelA}_ke_${hasil.labelB}.xlsx`.replace(/\s+/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
