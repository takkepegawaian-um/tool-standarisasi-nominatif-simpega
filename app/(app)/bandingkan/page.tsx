import { namaBulan } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { hitungPerbandinganBatch } from "@/lib/services/bandingkanBatchService";

import { BandingkanTabs } from "./BandingkanTabs";

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

  const hasilUntukUi = a && b ? await hitungPerbandinganBatch(a, b) : null;

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
        {hasilUntukUi && a && b && (
          <a
            href={`/bandingkan/export?a=${a}&b=${b}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Unduh .xlsx
          </a>
        )}
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
