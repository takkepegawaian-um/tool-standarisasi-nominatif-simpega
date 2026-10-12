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

// Sama seperti tambahJabatanTambahanRole di atas, tapi utk Unit Asal - dipakai saat target
// Jabatan Tambahan (mis. unit bisnis "Bistrovia") belum ada di master. Butuh unitIndukKode
// (induk/fakultas) karena itu foreign key wajib di skema unit_asal.
export async function tambahUnitAsal(
  nama: string,
  unitIndukKode: string
): Promise<{ kode: string; nama: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesi login sudah habis, silakan masuk ulang.");

  const trimmed = nama.trim();
  if (!trimmed) throw new Error("Nama unit tidak boleh kosong.");

  const indukValid = await prisma.unitInduk.findUnique({ where: { kode: unitIndukKode } });
  if (!indukValid) throw new Error("Unit Induk tidak valid.");

  const existing = await prisma.unitAsal.findFirst({
    where: { nama: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return { kode: existing.kode, nama: existing.nama };

  const semua = await prisma.unitAsal.findMany({ select: { kode: true } });
  const maxNum = semua.reduce((max, r) => {
    const m = r.kode.match(/^UA-(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const kode = `UA-${String(maxNum + 1).padStart(3, "0")}`;

  const created = await prisma.unitAsal.create({
    data: { kode, nama: trimmed, unitIndukKode },
  });

  return { kode: created.kode, nama: created.nama };
}

// Menambah Program Studi baru ke master LOKAL tool ini - dipakai saat target Jabatan Tambahan
// (mis. "Ketua Program Studi S1 Ilmu Sejarah") adalah prodi yang belum ada di master. Sebelumnya
// admin terpaksa menyimpannya sbg Unit Asal (tombol "Tambah unit" satu-satunya jalan), sehingga
// prodi masuk tabel yang salah dan namanya tidak cocok dgn master Program Studi di KDS2.
// unitAsalKode = fakultas/sekolah induk prodi (foreign key wajib di skema mst_program_studi).
export async function tambahProgramStudi(
  nama: string,
  jenjang: string,
  unitAsalKode: string
): Promise<{ kode: string; nama: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesi login sudah habis, silakan masuk ulang.");

  const trimmed = nama.trim();
  if (!trimmed) throw new Error("Nama program studi tidak boleh kosong.");
  if (!jenjang.trim()) throw new Error("Jenjang wajib dipilih.");

  const indukValid = await prisma.unitAsal.findUnique({ where: { kode: unitAsalKode } });
  if (!indukValid) throw new Error("Fakultas/unit induk prodi tidak valid.");

  const existing = await prisma.programStudi.findFirst({
    where: { nama: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return { kode: existing.kode, nama: existing.nama };

  const semua = await prisma.programStudi.findMany({ select: { kode: true } });
  const maxNum = semua.reduce((max, r) => {
    const m = r.kode.match(/^PRD-(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const kode = `PRD-${String(maxNum + 1).padStart(3, "0")}`;

  const created = await prisma.programStudi.create({
    data: { kode, nama: trimmed, jenjang: jenjang.trim(), unitAsalKode, statusValidasi: "Draft" },
  });

  return { kode: created.kode, nama: created.nama };
}
