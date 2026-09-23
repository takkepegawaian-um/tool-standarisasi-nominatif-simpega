import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Satu potongan file (jauh di bawah batas keras ~4.5MB body request function Vercel) per
// request - dipanggil berkali-kali oleh client utk merakit 1 file utuh lewat tabel UploadChunk,
// lihat komentar di prisma/schema.prisma utk alasan kenapa bukan Vercel Blob.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesi login sudah habis." }, { status: 401 });
  }

  const formData = await request.formData();
  const uploadId = formData.get("uploadId");
  const chunkIndexRaw = formData.get("chunkIndex");
  const chunk = formData.get("chunk");

  if (typeof uploadId !== "string" || !uploadId) {
    return NextResponse.json({ error: "uploadId tidak valid." }, { status: 400 });
  }
  const chunkIndex = Number(chunkIndexRaw);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "chunkIndex tidak valid." }, { status: 400 });
  }
  if (!(chunk instanceof Blob)) {
    return NextResponse.json({ error: "Bagian file tidak ditemukan." }, { status: 400 });
  }

  const data = Buffer.from(await chunk.arrayBuffer());

  await prisma.uploadChunk.upsert({
    where: { uploadId_chunkIndex: { uploadId, chunkIndex } },
    create: { uploadId, chunkIndex, data },
    update: { data },
  });

  return NextResponse.json({ ok: true });
}
