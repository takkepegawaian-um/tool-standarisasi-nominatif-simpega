import Link from "next/link";
import { notFound } from "next/navigation";

import { ALASAN_LABEL, namaBulan, type AlasanBarisBermasalah } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { RawNominatifRow } from "@/lib/excel/types";

export default async function ReviewListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const batch = await prisma.uploadBatch.findUnique({ where: { id } });
  if (!batch) notFound();

  const barisList = await prisma.barisBermasalah.findMany({
    where: { uploadBatchId: id, status: "Menunggu" },
    orderBy: { dibuatPada: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/batch/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Ringkasan Batch
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Review {namaBulan(batch.bulan)} {batch.tahun}
        </h1>
        <p className="text-sm text-slate-500">
          {barisList.length} baris menunggu penyelesaian manual.
        </p>
      </div>

      {barisList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Tidak ada baris yang perlu direview.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">NIP</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Alasan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {barisList.map((b) => {
                const raw = b.dataMentah as unknown as RawNominatifRow;
                const nama = raw.namaDenganGelar || raw.namaTanpaGelar || "(tanpa nama)";
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.nip}</td>
                    <td className="px-4 py-3 text-slate-900">{nama}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {ALASAN_LABEL[b.alasanUtama as AlasanBarisBermasalah] ?? b.alasanUtama}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/batch/${id}/review/${b.id}`}
                        className="rounded-md bg-sidebar px-3 py-1.5 text-xs font-medium text-white hover:bg-sidebar-lighter"
                      >
                        Selesaikan
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
