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

  if (!kategori || !nipUtama) {
    throw new Error("Data catatan tidak lengkap.");
  }
  if (!alasan) throw new Error("Alasan tidak boleh kosong.");

  const nipTerkait = nipTerkaitRaw ? (JSON.parse(nipTerkaitRaw) as string[]) : undefined;

  // Catatan dikunci ke (kategori, nipUtama) SAJA - bukan ke pasangan batch A/B yang sedang
  // dibandingkan - supaya tetap melekat ke NIP itu di perbandingan manapun yang melibatkan dia.
  // uploadBatchAId/uploadBatchBId cuma disimpan sbg konteks informatif (perbandingan terakhir
  // saat catatan ditulis/diedit).
  await prisma.catatanPerubahanBatch.upsert({
    where: { kategori_nipUtama: { kategori, nipUtama } },
    create: {
      uploadBatchAId: uploadBatchAId || null,
      uploadBatchBId: uploadBatchBId || null,
      kategori,
      nipUtama,
      nipTerkait,
      nama,
      alasan,
      dibuatOlehId: session.user.id,
    },
    update: {
      alasan,
      nama,
      nipTerkait,
      uploadBatchAId: uploadBatchAId || null,
      uploadBatchBId: uploadBatchBId || null,
    },
  });

  revalidatePath("/bandingkan");
}
