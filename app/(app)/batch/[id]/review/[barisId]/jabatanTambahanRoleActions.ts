"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Menambah role baru ke master LOKAL tool ini saja (dipakai saat admin menemukan Jabatan
// Tambahan resmi yang belum ada di daftar, mis. jabatan baru yang baru dibentuk). Master
// mst_jabatan_tambahan_role di SIMPEGA (Laravel) TERPISAH & tidak ikut ter-update otomatis -
// admin (user) yang tanggung jawab menyelaraskannya ke sana secara manual kalau perlu.
export async function tambahJabatanTambahanRole(
  namaRole: string,
  berlakuUntuk: "Dosen" | "Tendik"
): Promise<{ kode: string; namaRole: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesi login sudah habis, silakan masuk ulang.");

  const trimmed = namaRole.trim();
  if (!trimmed) throw new Error("Nama role tidak boleh kosong.");

  const existing = await prisma.jabatanTambahanRole.findFirst({
    where: { namaRole: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return { kode: existing.kode, namaRole: existing.namaRole };

  const semua = await prisma.jabatanTambahanRole.findMany({ select: { kode: true } });
  const maxNum = semua.reduce((max, r) => {
    const m = r.kode.match(/^JBT-(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const kode = `JBT-${String(maxNum + 1).padStart(2, "0")}`;

  const created = await prisma.jabatanTambahanRole.create({
    data: { kode, namaRole: trimmed, berlakuUntuk },
  });

  return { kode: created.kode, namaRole: created.namaRole };
}
