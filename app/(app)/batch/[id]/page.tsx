import Link from "next/link";
import { notFound } from "next/navigation";

import { ALASAN_LABEL, namaBulan, type AlasanBarisBermasalah } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const batch = await prisma.uploadBatch.findUnique({
    where: { id },
    include: { diunggahOleh: { select: { nama: true } } },
  });
  if (!batch) notFound();

  const breakdown = await prisma.barisBermasalah.groupBy({
    by: ["alasanUtama"],
    where: { uploadBatchId: id, status: "Menunggu" },
    _count: { _all: true },
  });

  const sisaMenunggu = breakdown.reduce((acc, b) => acc + b._count._all, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Dashboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          {namaBulan(batch.bulan)} {batch.tahun}
        </h1>
        <p className="text-sm text-slate-500">
          File: {batch.namaFileAsli} &middot; Diupload oleh {batch.diunggahOleh.nama}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Baris</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{batch.jumlahBarisTotal}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Berhasil</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{batch.jumlahBerhasil}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Perlu Review</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{sisaMenunggu}</p>
        </div>
      </div>

      {sisaMenunggu > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Rincian baris yang perlu direview:</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {breakdown.map((b) => (
              <li key={b.alasanUtama}>
                {b._count._all} baris: {ALASAN_LABEL[b.alasanUtama as AlasanBarisBermasalah] ?? b.alasanUtama}
              </li>
            ))}
          </ul>
          <Link
            href={`/batch/${batch.id}/review`}
            className="mt-3 inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Selesaikan Review
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">
            Semua baris sudah selesai diproses. File nominatif bulanan siap diunduh untuk
            diupload ke SIMPEGA.
          </p>
          <a
            href={`/batch/${batch.id}/export`}
            className="mt-3 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Unduh Nominatif Bulanan (.xlsx)
          </a>
        </div>
      )}

      <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">
          Peta kolom terdeteksi (audit parsing)
        </summary>
        <pre className="mt-2 overflow-x-auto text-xs text-slate-500">
          {JSON.stringify(batch.petaKolomTerdeteksi, null, 2)}
        </pre>
      </details>
    </div>
  );
}
