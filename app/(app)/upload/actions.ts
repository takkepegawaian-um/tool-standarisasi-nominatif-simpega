"use server";

import { redirect } from "next/navigation";

import { del } from "@vercel/blob";

import { auth } from "@/lib/auth";
import { ColumnMappingError } from "@/lib/excel/types";
import { importBatch } from "@/lib/services/importBatch";

export type UploadState = { error?: string };

// File mentah diunggah LANGSUNG dari browser ke Vercel Blob (lihat app/api/upload-token/route.ts)
// supaya tidak lewat batas keras ~4.5MB body request function Vercel - action ini cuma menerima
// URL-nya, ambil isinya sekali di server, lalu segera hapus dari Blob (raw export sensitif tidak
// perlu tersimpan lebih dari sesaat, konsisten dengan kebijakan minimisasi data proyek ini).
export async function processUploadedNominatif(
  bulan: number,
  tahun: number,
  blobUrl: string,
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
    const response = await fetch(blobUrl);
    if (!response.ok) return { error: "Gagal mengambil file yang sudah diunggah." };
    const buffer = Buffer.from(await response.arrayBuffer());

    const result = await importBatch(buffer, namaFileAsli, bulan, tahun, session.user.id);
    uploadBatchId = result.uploadBatchId;
  } catch (err) {
    if (err instanceof ColumnMappingError) {
      return { error: err.message };
    }
    throw err;
  } finally {
    await del(blobUrl).catch(() => {
      // Kegagalan hapus blob sementara bukan hal fatal - tidak perlu gagalkan proses upload.
    });
  }

  redirect(`/batch/${uploadBatchId}`);
}
