import { namaBulan } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { bandingkanDaftarPegawai, type PegawaiRingkas } from "@/lib/domain/bandingkanBatch";
import {
  isNipPlaceholderTidakStabil,
  JENIS_FIELD_IDENTITAS_EKSTERNAL,
  kunciIdentitasEksternal,
} from "@/lib/domain/identitasEksternal";
import { loadKamusMap } from "@/lib/domain/masterCache";

import { BandingkanTabs } from "./BandingkanTabs";

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
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }, { diunggahPada: "desc" }],
    select: { id: true, bulan: true, tahun: true, jumlahBarisTotal: true, diunggahPada: true },
  });

  let labelA: string | null = null;
  let labelB: string | null = null;
  let hasilUntukUi: {
    orangBaru: PegawaiRingkas[];
    orangHilang: PegawaiRingkas[];
    kemungkinanBerubah: Array<{
      hilang: PegawaiRingkas;
      baru: PegawaiRingkas;
      skor: number;
      sudahTercatat: boolean;
      polaPlaceholder: boolean;
    }>;
  } | null = null;

  if (a && b) {
    const [batchA, batchB] = await Promise.all([
      prisma.uploadBatch.findUnique({ where: { id: a } }),
      prisma.uploadBatch.findUnique({ where: { id: b } }),
    ]);

    if (batchA && batchB) {
      labelA = `${namaBulan(batchA.bulan)} ${batchA.tahun}`;
      labelB = `${namaBulan(batchB.bulan)} ${batchB.tahun}`;

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

      const kemungkinanBerubah = perbandingan.kemungkinanBerubah.map((pasangan) => {
        const kunci = kunciIdentitasEksternal(pasangan.baru.nama);
        const kamusNip = kamus.get(`${JENIS_FIELD_IDENTITAS_EKSTERNAL}::${kunci}`);
        const sudahTercatat = kamusNip === pasangan.baru.nip || kamusNip === pasangan.hilang.nip;
        const polaPlaceholder = isNipPlaceholderTidakStabil(pasangan.baru.nip, batchB.bulan, batchB.tahun);
        return { ...pasangan, sudahTercatat, polaPlaceholder };
      });

      hasilUntukUi = { ...perbandingan, kemungkinanBerubah };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bandingkan Batch</h1>
        <p className="text-sm text-slate-500">
          Cek penambahan, pengurangan, dan kemungkinan NIP berubah antara 2 batch nominatif manapun.
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

      {hasilUntukUi && labelA && labelB && (
        <BandingkanTabs
          labelA={labelA}
          labelB={labelB}
          orangBaru={hasilUntukUi.orangBaru}
          orangHilang={hasilUntukUi.orangHilang}
          kemungkinanBerubah={hasilUntukUi.kemungkinanBerubah}
        />
      )}
    </div>
  );
}
