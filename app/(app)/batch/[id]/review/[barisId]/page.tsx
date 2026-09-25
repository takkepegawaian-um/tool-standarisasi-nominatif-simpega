import Link from "next/link";
import { notFound } from "next/navigation";

import {
  pisahJabatanTambahanRaw,
  resolveGolongan,
  resolveJabatan,
  resolveJabatanTambahan,
  resolveKategoriAkademisiLuar,
  resolveKelompok,
  resolveStatusKepegawaian,
  resolveUnitKerja,
} from "@/lib/domain/classify";
import { loadKamusMap, loadMasterCache, loadNipTerdaftar } from "@/lib/domain/masterCache";
import { exactMatch } from "@/lib/domain/matching";
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

  const batch = await prisma.uploadBatch.findUniqueOrThrow({ where: { id: baris.uploadBatchId } });

  // Snapshot bulan SEBELUMNYA (kalau ada) utk NIP yang sama - dipakai sbg SARAN pengisian saat
  // field mentah kosong total di file sumber (bukan auto-terapkan, admin tetap harus konfirmasi
  // - unit kerja/jabatan orang BISA berubah antar bulan, ini cuma titik awal drpd cari dari nol).
  const snapshotSebelumnya = await prisma.nominatifBulanan.findFirst({
    where: {
      pegawaiNip: baris.nip,
      OR: [{ tahun: { lt: batch.tahun } }, { tahun: batch.tahun, bulan: { lt: batch.bulan } }],
    },
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
  });

  const [master, kamus, nipTerdaftar] = await Promise.all([loadMasterCache(), loadKamusMap(), loadNipTerdaftar()]);
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
    const jabatan = resolveJabatan(raw, master, kamus, prefillKelompok, nipTerdaftar);
    if (!("issue" in jabatan)) {
      if (jabatan.jabatanFungsionalDosenKode) prefillJabatan = `DOSEN:${jabatan.jabatanFungsionalDosenKode}`;
      else if (jabatan.jabatanFungsionalTendikKode) prefillJabatan = `TENDIK:${jabatan.jabatanFungsionalTendikKode}`;
      else if (jabatan.jabatanFungsiUmumKode) prefillJabatan = `UMUM:${jabatan.jabatanFungsiUmumKode}`;
    }
  }

  const unit = resolveUnitKerja(raw, master, kamus);
  let prefillUnit = "kode" in unit ? unit.kode : null;

  let catatanSaranBulanLalu: string | null = null;
  if (!prefillUnit && snapshotSebelumnya?.unitAsalKode) {
    prefillUnit = snapshotSebelumnya.unitAsalKode;
    catatanSaranBulanLalu =
      "Kolom Unit Kerja kosong total di file sumber - Unit Kerja di atas disarankan dari data bulan sebelumnya (belum tentu masih sama, konfirmasi dulu sebelum simpan).";
  }
  if (!prefillJabatan && snapshotSebelumnya) {
    if (snapshotSebelumnya.jabatanFungsionalDosenKode) {
      prefillJabatan = `DOSEN:${snapshotSebelumnya.jabatanFungsionalDosenKode}`;
    } else if (snapshotSebelumnya.jabatanFungsionalTendikKode) {
      prefillJabatan = `TENDIK:${snapshotSebelumnya.jabatanFungsionalTendikKode}`;
    } else if (snapshotSebelumnya.jabatanFungsiUmumKode) {
      prefillJabatan = `UMUM:${snapshotSebelumnya.jabatanFungsiUmumKode}`;
    }
    if (prefillJabatan) {
      catatanSaranBulanLalu =
        (catatanSaranBulanLalu ? `${catatanSaranBulanLalu} ` : "") +
        "Jabatan Fungsional/Fungsi kosong total di file sumber - disarankan dari data bulan sebelumnya (belum tentu masih sama, konfirmasi dulu sebelum simpan).";
    }
  }

  let prefillAdaJabatanTambahan = false;
  let prefillJabatanTambahanRoleKode: string | null = null;
  let prefillJabatanTambahanTargetKode: string | null = null;
  let prefillStatusPengangkatan: string | null = null;
  let prefillAdaJabatanTambahanKedua = false;
  let prefillJabatanTambahanRoleKode2: string | null = null;
  let prefillJabatanTambahanTargetKode2: string | null = null;
  let prefillStatusPengangkatan2: string | null = null;

  if (prefillKelompok && prefillKelompok !== "Akademisi Luar UM" && raw.jabatanTambahanRaw.trim()) {
    prefillAdaJabatanTambahan = true;
    const jt = resolveJabatanTambahan(raw, master, kamus, prefillKelompok);
    if ("slots" in jt && jt.slots.length > 0) {
      const [slot, slotKedua] = jt.slots;
      prefillJabatanTambahanRoleKode = slot.jabatanTambahanRoleKode;
      prefillJabatanTambahanTargetKode = slot.unitAsalKode
        ? `UNIT:${slot.unitAsalKode}`
        : slot.programStudiKode
          ? `PRODI:${slot.programStudiKode}`
          : null;
      prefillStatusPengangkatan = slot.statusPengangkatan;
      if (slotKedua) {
        prefillAdaJabatanTambahanKedua = true;
        prefillJabatanTambahanRoleKode2 = slotKedua.jabatanTambahanRoleKode;
        prefillJabatanTambahanTargetKode2 = slotKedua.unitAsalKode
          ? `UNIT:${slotKedua.unitAsalKode}`
          : slotKedua.programStudiKode
            ? `PRODI:${slotKedua.programStudiKode}`
            : null;
        prefillStatusPengangkatan2 = slotKedua.statusPengangkatan;
      }
    } else {
      // Kamus belum tahu Status Pengangkatan-nya, tapi role & unit/prodi mungkin tetap bisa
      // di-prefill dari pencocokan langsung supaya admin tidak perlu cari manual dari nol.
      const { roleRaw, unit: u, prodi, status } = pisahJabatanTambahanRaw(raw.jabatanTambahanRaw, master);
      const role = exactMatch(master.jabatanTambahanRole, (r) => r.namaRole, roleRaw);
      if (role) prefillJabatanTambahanRoleKode = role.kode;
      if (u) prefillJabatanTambahanTargetKode = `UNIT:${u.kode}`;
      else if (prodi) prefillJabatanTambahanTargetKode = `PRODI:${prodi.kode}`;
      if (status) prefillStatusPengangkatan = status;
    }
  }

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
          <dt className="font-medium">Jabatan Tambahan</dt>
          <dd className="col-span-2">{raw.jabatanTambahanRaw || "-"}</dd>
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

      {catatanSaranBulanLalu && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {catatanSaranBulanLalu} (Sumber saran: snapshot {snapshotSebelumnya?.bulan}/{snapshotSebelumnya?.tahun}.)
        </p>
      )}

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
          adaJabatanTambahan: prefillAdaJabatanTambahan,
          jabatanTambahanRoleKode: prefillJabatanTambahanRoleKode,
          jabatanTambahanTargetKode: prefillJabatanTambahanTargetKode,
          statusPengangkatan: prefillStatusPengangkatan,
          adaJabatanTambahanKedua: prefillAdaJabatanTambahanKedua,
          jabatanTambahanRoleKode2: prefillJabatanTambahanRoleKode2,
          jabatanTambahanTargetKode2: prefillJabatanTambahanTargetKode2,
          statusPengangkatan2: prefillStatusPengangkatan2,
        }}
        master={{
          statusKepegawaian: master.statusKepegawaian,
          golongan: master.golongan,
          jabatanFungsionalDosen: master.jabatanFungsionalDosen,
          jabatanFungsionalTendik: master.jabatanFungsionalTendik,
          jabatanFungsiUmumPelaksana: master.jabatanFungsiUmumPelaksana,
          kategoriAkademisiLuar: master.kategoriAkademisiLuar,
          unitAsal: master.unitAsal,
          jabatanTambahanRole: master.jabatanTambahanRole,
          programStudi: master.programStudi,
          unitInduk: master.unitInduk,
        }}
      />
    </div>
  );
}
