"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type HapusPegawaiState = { error?: string; sukses?: string };

/**
 * Hapus 1 baris NominatifBulanan (1 orang, HANYA di bulan batch ini - bulan lain tidak
 * tersentuh) - dipakai utk kasus salah input/duplikat, BUKAN utk "orang keluar" (kalau memang
 * keluar, cukup jangan dimasukkan lagi di upload bulan berikutnya, sesuai aturan bisnis "NIP
 * yang tidak muncul = dianggap tidak aktif").
 */
export async function hapusNominatifBulanan(
  batchId: string,
  nominatifBulananId: string,
  _prevState: HapusPegawaiState,
  _formData: FormData
): Promise<HapusPegawaiState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesi login sudah habis, silakan masuk ulang." };

  const nominatif = await prisma.nominatifBulanan.findUnique({ where: { id: nominatifBulananId } });
  if (!nominatif || nominatif.uploadBatchId !== batchId) {
    return { error: "Baris nominatif tidak ditemukan di batch ini." };
  }

  await prisma.$transaction([
    prisma.nominatifBulanan.delete({ where: { id: nominatifBulananId } }),
    prisma.uploadBatch.update({
      where: { id: batchId },
      data: { jumlahBarisTotal: { decrement: 1 }, jumlahBerhasil: { decrement: 1 } },
    }),
    prisma.auditLog.create({
      data: {
        aksi: "HapusNominatifBulanan",
        entitas: "NominatifBulanan",
        entitasId: nominatifBulananId,
        detail: { nip: nominatif.pegawaiNip, nama: nominatif.nama, bulan: nominatif.bulan, tahun: nominatif.tahun },
        dilakukanOlehId: session.user.id,
      },
    }),
  ]);

  revalidatePath(`/batch/${batchId}`);
  return { sukses: `${nominatif.nama} (NIP ${nominatif.pegawaiNip}) berhasil dihapus dari bulan ini.` };
}
