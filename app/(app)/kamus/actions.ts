"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function hapusKamusKoreksi(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesi login sudah habis.");

  const entry = await prisma.kamusKoreksi.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      aksi: "HapusKamusKoreksi",
      entitas: "KamusKoreksi",
      entitasId: id,
      detail: { jenisField: entry.jenisField, kunciMentah: entry.kunciMentah },
      dilakukanOlehId: session.user.id,
    },
  });

  revalidatePath("/kamus");
}
