import { namaBulan } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function ArsipPage() {
  const batches = await prisma.uploadBatch.findMany({
    where: { status: "Selesai" },
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
    include: { _count: { select: { nominatif: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Arsip Nominatif Bulanan</h1>
        <p className="text-sm text-slate-500">
          Histori bulan yang sudah selesai distandardisasi, siap diunggah ke SIMPEGA.
        </p>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Belum ada batch yang selesai.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Bulan</th>
                <th className="px-4 py-3">Jumlah Pegawai</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {namaBulan(b.bulan)} {b.tahun}
                  </td>
                  <td className="px-4 py-3">{b._count.nominatif}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/batch/${b.id}/export`}
                      className="rounded-md bg-sidebar px-3 py-1.5 text-xs font-medium text-white hover:bg-sidebar-lighter"
                    >
                      Unduh .xlsx
                    </a>
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
