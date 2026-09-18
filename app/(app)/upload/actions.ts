"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ColumnMappingError } from "@/lib/excel/types";
import { importBatch } from "@/lib/services/importBatch";

export type UploadState = { error?: string };

export async function uploadNominatifBulanan(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesi login sudah habis, silakan masuk ulang." };

  const bulan = Number(formData.get("bulan"));
  const tahun = Number(formData.get("tahun"));
  const file = formData.get("file");

  if (!bulan || bulan < 1 || bulan > 12) return { error: "Bulan tidak valid." };
  if (!tahun || tahun < 2000) return { error: "Tahun tidak valid." };
  if (!(file instanceof File) || file.size === 0) return { error: "File belum dipilih." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "File harus berformat .xlsx." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await importBatch(buffer, file.name, bulan, tahun, session.user.id);
  } catch (err) {
    if (err instanceof ColumnMappingError) {
      return { error: err.message };
    }
    throw err;
  }

  redirect(`/batch/${result.uploadBatchId}`);
}
