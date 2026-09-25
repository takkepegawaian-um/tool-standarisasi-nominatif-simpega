import Link from "next/link";
import { notFound } from "next/navigation";

import { ALASAN_LABEL, namaBulan, type AlasanBarisBermasalah } from "@/lib/constants";
import { prisma } from "@/lib/db";

import { HapusPegawaiButton } from "./HapusPegawaiButton";

export default async function BatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;

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

  const kataKunci = q?.trim() ?? "";
  const hasilPencarian = kataKunci
    ? await prisma.nominatifBulanan.findMany({
        where: {
          uploadBatchId: id,
          OR: [
            { pegawaiNip: { contains: kataKunci } },
            { nama: { contains: kataKunci, mode: "insensitive" } },
          ],
        },
        include: { jenisPegawai: true, unitAsal: true },
        orderBy: { nama: "asc" },
        take: 30,
      })
    : [];

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

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Cari & Kelola Pegawai (bulan ini)</p>
        <p className="mt-1 text-xs text-slate-500">
          Cari berdasarkan NIP atau nama untuk menghapus 1 baris salah input/duplikat - HANYA
          menghapus dari {namaBulan(batch.bulan)} {batch.tahun}, bulan lain tidak terpengaruh.
        </p>
        <form method="GET" className="mt-3 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={kataKunci}
            placeholder="NIP atau nama..."
            className="block w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-lighter"
          >
            Cari
          </button>
        </form>

        {kataKunci && (
          <div className="mt-4 overflow-x-auto">
            {hasilPencarian.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada pegawai yang cocok dengan &quot;{kataKunci}&quot; di bulan ini.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">NIP</th>
                    <th className="py-2 pr-3">Nama</th>
                    <th className="py-2 pr-3">Jenis Pegawai</th>
                    <th className="py-2 pr-3">Unit Kerja</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {hasilPencarian.map((n) => (
                    <tr key={n.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-mono text-xs">{n.pegawaiNip}</td>
                      <td className="py-2 pr-3">{n.nama}</td>
                      <td className="py-2 pr-3">{n.jenisPegawai.nama}</td>
                      <td className="py-2 pr-3">{n.unitAsal.nama}</td>
                      <td className="py-2 pr-3">
                        <HapusPegawaiButton batchId={batch.id} nominatifBulananId={n.id} nama={n.nama} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

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
