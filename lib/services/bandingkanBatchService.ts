import { namaBulan } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { bandingkanDaftarPegawai, nipUtamaAnomali, type AnomaliNip, type PegawaiRingkas } from "@/lib/domain/bandingkanBatch";
import {
  isNipPlaceholderTidakStabil,
  JENIS_FIELD_IDENTITAS_EKSTERNAL,
  kunciIdentitasEksternal,
} from "@/lib/domain/identitasEksternal";
import { loadKamusMap } from "@/lib/domain/masterCache";

export type AnomaliTampil = AnomaliNip & { sudahTercatat: boolean; polaPlaceholder: boolean };

export type HasilPerbandinganBatch = {
  labelA: string;
  labelB: string;
  orangBaru: PegawaiRingkas[];
  orangHilang: PegawaiRingkas[];
  nipAnomali: AnomaliTampil[];
  catatanTersimpan: { kategori: string; nipUtama: string; alasan: string }[];
};

function toRingkas(p: {
  pegawaiNip: string;
  nama: string;
  jenisPegawai: { nama: string };
  statusKepegawaian: { nama: string };
  unitAsal: { nama: string };
}): PegawaiRingkas {
  return {
    nip: p.pegawaiNip,
    nama: p.nama,
    jenisPegawai: p.jenisPegawai.nama,
    status: p.statusKepegawaian.nama,
    unitKerja: p.unitAsal.nama,
  };
}

/** Dipakai bareng oleh halaman /bandingkan (tampil) dan /bandingkan/export (unduh .xlsx) supaya
 *  dua-duanya selalu menghitung hasil yang persis sama. */
export async function hitungPerbandinganBatch(
  batchAId: string,
  batchBId: string
): Promise<HasilPerbandinganBatch | null> {
  const [batchA, batchB] = await Promise.all([
    prisma.uploadBatch.findUnique({ where: { id: batchAId } }),
    prisma.uploadBatch.findUnique({ where: { id: batchBId } }),
  ]);
  if (!batchA || !batchB) return null;

  const select = {
    pegawaiNip: true,
    nama: true,
    jenisPegawai: { select: { nama: true } },
    statusKepegawaian: { select: { nama: true } },
    unitAsal: { select: { nama: true } },
  } as const;

  const [pegawaiA, pegawaiB, kamus] = await Promise.all([
    prisma.nominatifBulanan.findMany({ where: { uploadBatchId: batchAId }, select }),
    prisma.nominatifBulanan.findMany({ where: { uploadBatchId: batchBId }, select }),
    loadKamusMap(),
  ]);

  const perbandingan = bandingkanDaftarPegawai(pegawaiA.map(toRingkas), pegawaiB.map(toRingkas));

  const nipAnomali: AnomaliTampil[] = perbandingan.nipAnomali.map((anomali) => {
    const sudahTercatat = anomali.anggota.some((anggota) => {
      const kunci = kunciIdentitasEksternal(anggota.nama);
      const kamusNip = kamus.get(`${JENIS_FIELD_IDENTITAS_EKSTERNAL}::${kunci}`);
      return anomali.anggota.some((a2) => a2.nip === kamusNip);
    });
    const polaPlaceholder = anomali.anggota.some((anggota) =>
      isNipPlaceholderTidakStabil(anggota.nip, batchB.bulan, batchB.tahun)
    );
    return { ...anomali, sudahTercatat, polaPlaceholder };
  });

  // Catatan dicari berdasarkan NIP yang relevan ke perbandingan INI SAJA (bukan dikunci ke
  // pasangan batch A/B-nya) - lihat lib/domain/bandingkanBatch.ts & app/(app)/bandingkan/catatanActions.ts.
  const nipUtamaBaru = perbandingan.orangBaru.map((p) => p.nip);
  const nipUtamaHilang = perbandingan.orangHilang.map((p) => p.nip);
  const nipUtamaAnomaliList = perbandingan.nipAnomali.map((anomali) => nipUtamaAnomali(anomali));
  const semuaNipUtamaRelevan = [...nipUtamaBaru, ...nipUtamaHilang, ...nipUtamaAnomaliList];

  const catatanTersimpan = await prisma.catatanPerubahanBatch.findMany({
    where: { nipUtama: { in: semuaNipUtamaRelevan } },
    select: { kategori: true, nipUtama: true, alasan: true },
  });

  return {
    labelA: `${namaBulan(batchA.bulan)} ${batchA.tahun}`,
    labelB: `${namaBulan(batchB.bulan)} ${batchB.tahun}`,
    orangBaru: perbandingan.orangBaru,
    orangHilang: perbandingan.orangHilang,
    nipAnomali,
    catatanTersimpan,
  };
}
