import Link from "next/link";

import { prisma } from "@/lib/db";
import { namaBulan } from "@/lib/constants";

const STATUS_BADGE: Record<string, string> = {
  Diproses: "bg-slate-100 text-slate-600",
  MenungguReview: "bg-amber-100 text-amber-700",
  Selesai: "bg-emerald-100 text-emerald-700",
  Dibatalkan: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  Diproses: "Diproses",
  MenungguReview: "Menunggu review",
  Selesai: "Selesai",
  Dibatalkan: "Dibatalkan",
};

export default async function DashboardPage() {
  const batches = await prisma.uploadBatch.findMany({
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }, { diunggahPada: "desc" }],
    include: { diunggahOleh: { select: { nama: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Batch Nominatif Bulanan</h1>
          <p className="text-sm text-slate-500">
            Riwayat upload &amp; standardisasi nominatif per bulan.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-lighter"
        >
          Upload Bulan Baru
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Belum ada batch yang diupload. Mulai dengan mengupload file nominatif mentah bulan
          pertama.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Bulan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Berhasil</th>
                <th className="px-4 py-3">Perlu Review</th>
                <th className="px-4 py-3">Diupload oleh</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {namaBulan(b.bulan)} {b.tahun}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[b.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{b.jumlahBerhasil}</td>
                  <td className="px-4 py-3">
                    {b.jumlahPerluReview > 0 ? (
                      <span className="font-medium text-amber-700">{b.jumlahPerluReview}</span>
                    ) : (
                      0
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{b.diunggahOleh.nama}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/batch/${b.id}`} className="text-slate-700 underline hover:text-slate-900">
                      Lihat
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
