import { prisma } from "@/lib/db";

/**
 * Snapshot seluruh master data di memori untuk 1 proses import batch (maks ~180 baris per
 * tabel, total kecil) - menghindari N+1 query per baris nominatif (bisa ribuan baris/bulan).
 */
export async function loadMasterCache() {
  const [
    jenisPegawai,
    statusKepegawaian,
    golongan,
    jabatanFungsionalDosen,
    jabatanFungsionalTendik,
    jabatanFungsiUmumPelaksana,
    kategoriAkademisiLuar,
    unitAsal,
    jabatanTambahanRole,
    programStudi,
    unitInduk,
  ] = await Promise.all([
    prisma.jenisPegawai.findMany(),
    prisma.statusKepegawaian.findMany(),
    prisma.golongan.findMany(),
    prisma.jabatanFungsionalDosen.findMany(),
    prisma.jabatanFungsionalTendik.findMany(),
    prisma.jabatanFungsiUmumPelaksana.findMany(),
    prisma.kategoriAkademisiLuar.findMany(),
    prisma.unitAsal.findMany(),
    prisma.jabatanTambahanRole.findMany(),
    prisma.programStudi.findMany(),
    prisma.unitInduk.findMany(),
  ]);

  return {
    jenisPegawai,
    statusKepegawaian,
    golongan,
    jabatanFungsionalDosen,
    jabatanFungsionalTendik,
    jabatanFungsiUmumPelaksana,
    kategoriAkademisiLuar,
    unitAsal,
    jabatanTambahanRole,
    programStudi,
    unitInduk,
  };
}

export type MasterCache = Awaited<ReturnType<typeof loadMasterCache>>;

export type KamusMap = Map<string, string>;

export async function loadKamusMap(): Promise<KamusMap> {
  const rows = await prisma.kamusKoreksi.findMany();
  return new Map(rows.map((r) => [`${r.jenisField}::${r.kunciMentah}`, r.nilaiResolusi]));
}
