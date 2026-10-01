"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function simpanCatatanPerubahan(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesi login sudah habis, silakan masuk ulang.");

  const uploadBatchAId = String(formData.get("uploadBatchAId") ?? "");
  const uploadBatchBId = String(formData.get("uploadBatchBId") ?? "");
  const kategori = String(formData.get("kategori") ?? "");
  const nipUtama = String(formData.get("nipUtama") ?? "");
  const nama = String(formData.get("nama") ?? "");
  const alasan = String(formData.get("alasan") ?? "").trim();
  const nipTerkaitRaw = String(formData.get("nipTerkait") ?? "");

  if (!uploadBatchAId || !uploadBatchBId || !kategori || !nipUtama) {
    throw new Error("Data catatan tidak lengkap.");
  }
  if (!alasan) throw new Error("Alasan tidak boleh kosong.");

  const nipTerkait = nipTerkaitRaw ? (JSON.parse(nipTerkaitRaw) as string[]) : undefined;

  await prisma.catatanPerubahanBatch.upsert({
    where: {
      uploadBatchAId_uploadBatchBId_kategori_nipUtama: { uploadBatchAId, uploadBatchBId, kategori, nipUtama },
    },
    create: {
      uploadBatchAId,
      uploadBatchBId,
      kategori,
      nipUtama,
      nipTerkait,
      nama,
      alasan,
      dibuatOlehId: session.user.id,
    },
    update: { alasan, nama, nipTerkait },
  });

  revalidatePath("/bandingkan");
}
