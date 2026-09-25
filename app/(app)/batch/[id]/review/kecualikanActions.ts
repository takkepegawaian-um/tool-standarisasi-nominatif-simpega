"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type KecualikanState = { error?: string };

/**
 * Kecualikan 1 baris bermasalah dari arsip (status "Dikecualikan") - dipakai utk baris yang
 * genuinely tidak bisa diselesaikan (mis. nama & jenis kelamin kosong total di file sumber,
 * tidak ada jejaknya di bulan manapun) - beda dari "Selesaikan" yang butuh data lengkap.
 */
export async function kecualikanBarisBermasalah(
  batchId: string,
  barisBermasalahId: string,
  _prevState: KecualikanState,
  _formData: FormData
): Promise<KecualikanState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesi login sudah habis, silakan masuk ulang." };

  const baris = await prisma.barisBermasalah.findUnique({ where: { id: barisBermasalahId } });
  if (!baris || baris.uploadBatchId !== batchId) return { error: "Baris tidak ditemukan di batch ini." };
  if (baris.status !== "Menunggu") return { error: "Baris ini sudah diproses sebelumnya." };

  await prisma.$transaction(async (tx) => {
    await tx.barisBermasalah.update({
      where: { id: barisBermasalahId },
      data: { status: "Dikecualikan", diselesaikanOlehId: session.user!.id, diselesaikanPada: new Date() },
    });
    await tx.auditLog.create({
      data: {
        aksi: "KecualikanBarisBermasalah",
        entitas: "BarisBermasalah",
        entitasId: barisBermasalahId,
        detail: { nip: baris.nip },
        dilakukanOlehId: session.user!.id,
      },
    });
    const sisaMenunggu = await tx.barisBermasalah.count({ where: { uploadBatchId: batchId, status: "Menunggu" } });
    await tx.uploadBatch.update({
      where: { id: batchId },
      data: { jumlahPerluReview: sisaMenunggu, status: sisaMenunggu === 0 ? "Selesai" : "MenungguReview" },
    });
  });

  revalidatePath(`/batch/${batchId}/review`);
  revalidatePath(`/batch/${batchId}`);
  return {};
}
