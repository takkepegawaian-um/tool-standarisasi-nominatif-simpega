import { namaBulan } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { bandingkanDaftarPegawai, nipUtamaAnomali, type PegawaiRingkas } from "@/lib/domain/bandingkanBatch";
import {
  isNipPlaceholderTidakStabil,
  JENIS_FIELD_IDENTITAS_EKSTERNAL,
  kunciIdentitasEksternal,
} from "@/lib/domain/identitasEksternal";
import { loadKamusMap } from "@/lib/domain/masterCache";

import { BandingkanTabs, type AnomaliTampil } from "./BandingkanTabs";

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

export default async function BandingkanPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  const batchList = await prisma.uploadBatch.findMany({
    // Batch "Dibatalkan" (sudah ditimpa upload ulang bulan/tahun yang sama) sengaja disembunyikan
    // dari sini - datanya sudah 0, membandingkannya tidak ada gunanya & cuma membingungkan.
    where: { status: { not: "Dibatalkan" } },
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }, { diunggahPada: "desc" }],
    select: { id: true, bulan: true, tahun: true, jumlahBarisTotal: true, diunggahPada: true },
  });

  let hasilUntukUi: {
    orangBaru: PegawaiRingkas[];
    orangHilang: PegawaiRingkas[];
    nipAnomali: AnomaliTampil[];
    catatanTersimpan: { kategori: string; nipUtama: string; alasan: string }[];
  } | null = null;

  if (a && b) {
    const [batchA, batchB] = await Promise.all([
      prisma.uploadBatch.findUnique({ where: { id: a } }),
      prisma.uploadBatch.findUnique({ where: { id: b } }),
    ]);

    if (batchA && batchB) {
      const select = {
        pegawaiNip: true,
        nama: true,
        jenisPegawai: { select: { nama: true } },
        statusKepegawaian: { select: { nama: true } },
        unitAsal: { select: { nama: true } },
      } as const;

      const [pegawaiA, pegawaiB, kamus] = await Promise.all([
        prisma.nominatifBulanan.findMany({ where: { uploadBatchId: a }, select }),
        prisma.nominatifBulanan.findMany({ where: { uploadBatchId: b }, select }),
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

      // Catatan dicari berdasarkan NIP yang relevan ke perbandingan SAAT INI (bukan pasangan batch
      // A/B-nya) - supaya alasan yang sudah diisi admin di perbandingan LAIN (mis. September 2025
      // vs September 2026) tetap kelihatan di sini kalau NIP-nya sama (mis. Agustus vs September).
      const nipUtamaBaru = perbandingan.orangBaru.map((p) => p.nip);
      const nipUtamaHilang = perbandingan.orangHilang.map((p) => p.nip);
      const nipUtamaAnomaliList = perbandingan.nipAnomali.map((anomali) => nipUtamaAnomali(anomali));
      const semuaNipUtamaRelevan = [...nipUtamaBaru, ...nipUtamaHilang, ...nipUtamaAnomaliList];

      const catatanTersimpan = await prisma.catatanPerubahanBatch.findMany({
        where: { nipUtama: { in: semuaNipUtamaRelevan } },
        select: { kategori: true, nipUtama: true, alasan: true },
      });

      hasilUntukUi = { ...perbandingan, nipAnomali, catatanTersimpan };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bandingkan Batch</h1>
        <p className="text-sm text-slate-500">
          Cek penambahan, pengurangan, dan anomali NIP (duplikat/berubah) antara 2 batch nominatif manapun.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Batch A (dibandingkan DARI)</label>
          <select
            name="a"
            defaultValue={a ?? ""}
            required
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Pilih batch...
            </option>
            {batchList.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {namaBulan(bt.bulan)} {bt.tahun} — {bt.jumlahBarisTotal} baris
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Batch B (dibandingkan KE)</label>
          <select
            name="b"
            defaultValue={b ?? ""}
            required
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Pilih batch...
            </option>
            {batchList.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {namaBulan(bt.bulan)} {bt.tahun} — {bt.jumlahBarisTotal} baris
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-lighter"
        >
          Bandingkan
        </button>
      </form>

      {hasilUntukUi && a && b && (
        <BandingkanTabs
          batchAId={a}
          batchBId={b}
          orangBaru={hasilUntukUi.orangBaru}
          orangHilang={hasilUntukUi.orangHilang}
          nipAnomali={hasilUntukUi.nipAnomali}
          catatanTersimpan={hasilUntukUi.catatanTersimpan}
        />
      )}
    </div>
  );
}
