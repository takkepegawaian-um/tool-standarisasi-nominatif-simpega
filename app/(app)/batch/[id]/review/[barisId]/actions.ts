"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { ResolvedNominatif } from "@/lib/domain/classify";
import { resolveRow } from "@/lib/services/resolveRow";

export type ResolveState = { error?: string };

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function resolveBarisBermasalah(
  batchId: string,
  barisBermasalahId: string,
  _prevState: ResolveState,
  formData: FormData
): Promise<ResolveState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesi login sudah habis, silakan masuk ulang." };

  const kelompokRaw = formData.get("kelompok");
  if (kelompokRaw !== "Dosen" && kelompokRaw !== "Tendik" && kelompokRaw !== "Akademisi Luar UM") {
    return { error: "Kelompok pegawai wajib dipilih." };
  }
  const kelompok = kelompokRaw as "Dosen" | "Tendik" | "Akademisi Luar UM";

  const nama = String(formData.get("nama") ?? "").trim();
  const jenisKelaminRaw = formData.get("jenisKelamin");
  if (jenisKelaminRaw !== "L" && jenisKelaminRaw !== "P") {
    return { error: "Jenis kelamin wajib L/P." };
  }
  const jenisKelamin = jenisKelaminRaw as "L" | "P";
  const tanggalLahir = parseDate(formData.get("tanggalLahir"));
  const tanggalMulaiKerja = parseDate(formData.get("tanggalMulaiKerja"));
  const statusKepegawaianKode = String(formData.get("statusKepegawaianKode") ?? "").trim();
  const golonganKode = String(formData.get("golonganKode") ?? "").trim() || null;
  const unitAsalKode = String(formData.get("unitAsalKode") ?? "").trim();
  const kategoriAkademisiLuarKode = String(formData.get("kategoriAkademisiLuarKode") ?? "").trim() || null;
  const jabatanPilihan = String(formData.get("jabatanPilihan") ?? "").trim();
  const pendidikanTerakhir = String(formData.get("pendidikanTerakhir") ?? "").trim() || null;
  const agama = String(formData.get("agama") ?? "").trim() || null;

  if (!nama) return { error: "Nama wajib diisi." };
  if (!tanggalLahir) return { error: "Tanggal lahir tidak valid." };
  if (!tanggalMulaiKerja) return { error: "Tanggal mulai kerja (TMT) tidak valid." };
  if (!statusKepegawaianKode) return { error: "Status kepegawaian wajib dipilih." };
  if (!unitAsalKode) return { error: "Unit kerja wajib dipilih." };
  if (kelompok === "Akademisi Luar UM" && !kategoriAkademisiLuarKode) {
    return { error: "Kategori Akademisi Luar wajib dipilih untuk kelompok Akademisi Luar UM." };
  }

  let jabatanFungsionalDosenKode: string | null = null;
  let jabatanFungsionalTendikKode: string | null = null;
  let jabatanFungsiUmumKode: string | null = null;
  if (jabatanPilihan) {
    const [tipe, kode] = jabatanPilihan.split(":");
    if (tipe === "DOSEN") jabatanFungsionalDosenKode = kode;
    else if (tipe === "TENDIK") jabatanFungsionalTendikKode = kode;
    else if (tipe === "UMUM") jabatanFungsiUmumKode = kode;
  } else if (kelompok !== "Akademisi Luar UM") {
    return { error: "Jabatan fungsional/fungsi wajib dipilih." };
  }

  const data: ResolvedNominatif = {
    nama,
    jenisKelamin,
    tanggalLahir,
    tanggalMulaiKerja,
    pendidikanTerakhir,
    agama,
    jenisPegawaiKode: "", // diisi ulang di bawah setelah lookup master, lihat catatan
    statusKepegawaianKode: kelompok === "Akademisi Luar UM" ? "PTT" : statusKepegawaianKode,
    golonganKode: kelompok === "Akademisi Luar UM" ? null : golonganKode,
    jabatanFungsionalDosenKode,
    jabatanFungsionalTendikKode,
    jabatanFungsiUmumKode,
    kategoriAkademisiLuarKode: kelompok === "Akademisi Luar UM" ? kategoriAkademisiLuarKode : null,
    unitAsalKode,
  };

  const { prisma } = await import("@/lib/db");
  const jenisPegawai = await prisma.jenisPegawai.findFirst({
    where: { nama: kelompok },
  });
  if (!jenisPegawai) return { error: `Master Jenis Pegawai untuk "${kelompok}" tidak ditemukan.` };
  data.jenisPegawaiKode = jenisPegawai.kode;

  await resolveRow({
    barisBermasalahId,
    kelompok,
    data,
    ingat: {
      klasifikasi: formData.get("ingatKlasifikasi") === "on",
      kategoriAkademisiLuar: formData.get("ingatKategori") === "on",
      statusKepegawaian: formData.get("ingatStatus") === "on",
      golongan: formData.get("ingatGolongan") === "on",
      jabatan: formData.get("ingatJabatan") === "on",
      unitKerja: formData.get("ingatUnit") === "on",
    },
    diselesaikanOlehId: session.user.id,
  });

  redirect(`/batch/${batchId}/review`);
}
