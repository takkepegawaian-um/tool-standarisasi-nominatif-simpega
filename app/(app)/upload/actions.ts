"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ColumnMappingError } from "@/lib/excel/types";
import { importBatch } from "@/lib/services/importBatch";

export type UploadState = { error?: string };

// File mentah dirakit dari potongan-potongan kecil yang sudah dikirim satu-satu ke
// /api/upload-chunk (lihat prisma/schema.prisma untuk alasan pendekatan ini, bukan Vercel Blob).
// Action ini menggabungkan semua potongan uploadId ini, memprosesnya seperti biasa, lalu
// membersihkan potongan-potongan itu dari DB (tidak perlu tersimpan lebih dari sesaat).
export async function processUploadedNominatif(
  bulan: number,
  tahun: number,
  uploadId: string,
  totalChunks: number,
  namaFileAsli: string
): Promise<UploadState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesi login sudah habis, silakan masuk ulang." };

  if (!bulan || bulan < 1 || bulan > 12) return { error: "Bulan tidak valid." };
  if (!tahun || tahun < 2000) return { error: "Tahun tidak valid." };
  if (!namaFileAsli.toLowerCase().endsWith(".xlsx")) {
    return { error: "File harus berformat .xlsx." };
  }

  let uploadBatchId: string;
  try {
    const chunks = await prisma.uploadChunk.findMany({
      where: { uploadId },
      orderBy: { chunkIndex: "asc" },
    });
    if (chunks.length !== totalChunks || chunks.some((c, i) => c.chunkIndex !== i)) {
      return { error: "Bagian file yang diterima tidak lengkap, silakan upload ulang." };
    }

    const buffer = Buffer.concat(chunks.map((c) => c.data));
    const result = await importBatch(buffer, namaFileAsli, bulan, tahun, session.user.id);
    uploadBatchId = result.uploadBatchId;
  } catch (err) {
    if (err instanceof ColumnMappingError) {
      return { error: err.message };
    }
    throw err;
  } finally {
    await prisma.uploadChunk.deleteMany({ where: { uploadId } });
  }

  redirect(`/batch/${uploadBatchId}`);
}
