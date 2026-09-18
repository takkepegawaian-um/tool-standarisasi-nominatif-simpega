import Link from "next/link";
import { notFound } from "next/navigation";

import {
  resolveGolongan,
  resolveJabatan,
  resolveKategoriAkademisiLuar,
  resolveKelompok,
  resolveStatusKepegawaian,
  resolveUnitKerja,
} from "@/lib/domain/classify";
import { loadKamusMap, loadMasterCache } from "@/lib/domain/masterCache";
import { prisma } from "@/lib/db";
import type { RawNominatifRow } from "@/lib/excel/types";

import { ResolveForm } from "./ResolveForm";

export default async function ResolveRowPage({
  params,
}: {
  params: Promise<{ id: string; barisId: string }>;
}) {
  const { id: batchId, barisId } = await params;

  const baris = await prisma.barisBermasalah.findUnique({ where: { id: barisId } });
  if (!baris) notFound();

  const [master, kamus] = await Promise.all([loadMasterCache(), loadKamusMap()]);
  const raw = baris.dataMentah as unknown as RawNominatifRow;

  const kelompokResult = resolveKelompok(raw, master, kamus);
  const prefillKelompok = "kelompok" in kelompokResult ? kelompokResult.kelompok : null;

  let prefillStatus: string | null = null;
  let prefillGolongan: string | null = null;
  let prefillKategori: string | null = null;
  let prefillJabatan: string | null = null;

  if (prefillKelompok === "Akademisi Luar UM") {
    const kat = resolveKategoriAkademisiLuar(raw, master, kamus);
    if ("kode" in kat) prefillKategori = kat.kode;
  } else if (prefillKelompok) {
    const status = resolveStatusKepegawaian(raw, master, kamus);
    if ("kode" in status) {
      prefillStatus = status.kode;
      const golongan = resolveGolongan(raw, master, kamus, status.kategori);
      if ("kode" in golongan) prefillGolongan = golongan.kode;
    }
  }

  if (prefillKelompok) {
    const jabatan = resolveJabatan(raw, master, kamus, prefillKelompok);
    if (!("issue" in jabatan)) {
      if (jabatan.jabatanFungsionalDosenKode) prefillJabatan = `DOSEN:${jabatan.jabatanFungsionalDosenKode}`;
      else if (jabatan.jabatanFungsionalTendikKode) prefillJabatan = `TENDIK:${jabatan.jabatanFungsionalTendikKode}`;
      else if (jabatan.jabatanFungsiUmumKode) prefillJabatan = `UMUM:${jabatan.jabatanFungsiUmumKode}`;
    }
  }

  const unit = resolveUnitKerja(raw, master, kamus);
  const prefillUnit = "kode" in unit ? unit.kode : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/batch/${batchId}/review`} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Daftar Review
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Selesaikan Baris — NIP {baris.nip}
        </h1>
        <p className="text-sm text-slate-500">{baris.detailAlasan}</p>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm" open>
        <summary className="cursor-pointer font-medium text-slate-700">Data mentah dari file sumber</summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
          <dt className="font-medium">Nama (dengan gelar)</dt>
          <dd className="col-span-2">{raw.namaDenganGelar || "-"}</dd>
          <dt className="font-medium">Jenis Kelamin</dt>
          <dd className="col-span-2">{raw.jenisKelaminRaw || "-"}</dd>
          <dt className="font-medium">Jenis Pegawai</dt>
          <dd className="col-span-2">{raw.jenisPegawaiRaw || "-"}</dd>
          <dt className="font-medium">Status Pegawai</dt>
          <dd className="col-span-2">{raw.statusPegawaiRaw || "-"}</dd>
          <dt className="font-medium">Golongan Pangkat</dt>
          <dd className="col-span-2">{raw.golonganPangkatRaw || "-"}</dd>
          <dt className="font-medium">Jabatan Fungsional</dt>
          <dd className="col-span-2">{raw.jabatanFungsionalRaw || "-"}</dd>
          <dt className="font-medium">Subag/Unit Kerja</dt>
          <dd className="col-span-2">{raw.subagUnitKerjaRaw || "-"}</dd>
          <dt className="font-medium">Unit/Unit Kerja Induk</dt>
          <dd className="col-span-2">{raw.unitKerjaIndukRaw || "-"}</dd>
          <dt className="font-medium">Direktorat/Fakultas</dt>
          <dd className="col-span-2">{raw.direktoratFakultasRaw || "-"}</dd>
          <dt className="font-medium">Unit Statistik</dt>
          <dd className="col-span-2">{raw.unitStatistikRaw || "-"}</dd>
        </dl>
      </details>

      <ResolveForm
        batchId={batchId}
        barisId={barisId}
        raw={raw}
        prefill={{
          kelompok: prefillKelompok,
          statusKepegawaianKode: prefillStatus,
          golonganKode: prefillGolongan,
          kategoriAkademisiLuarKode: prefillKategori,
          jabatanPilihan: prefillJabatan,
          unitAsalKode: prefillUnit,
        }}
        master={{
          statusKepegawaian: master.statusKepegawaian,
          golongan: master.golongan,
          jabatanFungsionalDosen: master.jabatanFungsionalDosen,
          jabatanFungsionalTendik: master.jabatanFungsionalTendik,
          jabatanFungsiUmumPelaksana: master.jabatanFungsiUmumPelaksana,
          kategoriAkademisiLuar: master.kategoriAkademisiLuar,
          unitAsal: master.unitAsal,
        }}
      />
    </div>
  );
}
