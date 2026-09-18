import { prisma } from "@/lib/db";
import type { JabatanTambahanSlot, ResolvedNominatif } from "@/lib/domain/classify";
import {
  encodeJabatanTambahan,
  kunciGolongan,
  kunciJabatan,
  kunciJabatanTambahan,
  kunciKategoriAkademisiLuar,
  kunciKlasifikasi,
  kunciStatusKepegawaian,
  kunciUnitKerja,
} from "@/lib/domain/classify";
import type { RawNominatifRow } from "@/lib/excel/types";

export type IngatFlags = {
  klasifikasi?: boolean;
  kategoriAkademisiLuar?: boolean;
  statusKepegawaian?: boolean;
  golongan?: boolean;
  jabatan?: boolean;
  unitKerja?: boolean;
  jabatanTambahan?: boolean;
};

export type ResolveRowInput = {
  barisBermasalahId: string;
  kelompok: "Dosen" | "Tendik" | "Akademisi Luar UM";
  data: ResolvedNominatif;
  ingat: IngatFlags;
  diselesaikanOlehId: string;
};

function jabatanKodeUntukKamus(data: ResolvedNominatif): string | null {
  return data.jabatanFungsionalDosenKode ?? data.jabatanFungsionalTendikKode ?? data.jabatanFungsiUmumKode ?? null;
}

function jenisFieldJabatan(data: ResolvedNominatif): "JabatanFungsionalDosen" | "JabatanFungsionalTendik" | "FungsiUmumPelaksana" | null {
  if (data.jabatanFungsionalDosenKode) return "JabatanFungsionalDosen";
  if (data.jabatanFungsionalTendikKode) return "JabatanFungsionalTendik";
  if (data.jabatanFungsiUmumKode) return "FungsiUmumPelaksana";
  return null;
}

export async function resolveRow(input: ResolveRowInput): Promise<void> {
  const baris = await prisma.barisBermasalah.findUniqueOrThrow({
    where: { id: input.barisBermasalahId },
  });
  const rawRow = baris.dataMentah as unknown as RawNominatifRow;

  await prisma.$transaction(async (tx) => {
    await tx.pegawai.upsert({
      where: { nip: baris.nip },
      create: { nip: baris.nip },
      update: {},
    });

    const nominatifBulanan = await tx.uploadBatch.findUniqueOrThrow({
      where: { id: baris.uploadBatchId },
      select: { bulan: true, tahun: true },
    });

    const { jabatanTambahan, ...nominatifData } = input.data;

    const nominatif = await tx.nominatifBulanan.upsert({
      where: {
        pegawaiNip_bulan_tahun: {
          pegawaiNip: baris.nip,
          bulan: nominatifBulanan.bulan,
          tahun: nominatifBulanan.tahun,
        },
      },
      create: {
        pegawaiNip: baris.nip,
        bulan: nominatifBulanan.bulan,
        tahun: nominatifBulanan.tahun,
        uploadBatchId: baris.uploadBatchId,
        ...nominatifData,
      },
      update: { uploadBatchId: baris.uploadBatchId, ...nominatifData },
    });

    await tx.nominatifBulananJabatanTambahan.deleteMany({
      where: { nominatifBulananId: nominatif.id },
    });
    if (jabatanTambahan) {
      await tx.nominatifBulananJabatanTambahan.create({
        data: { nominatifBulananId: nominatif.id, ...jabatanTambahan },
      });
    }

    await tx.barisBermasalah.update({
      where: { id: baris.id },
      data: {
        status: "Terselesaikan",
        resolvedFields: input.data as unknown as object,
        diselesaikanOlehId: input.diselesaikanOlehId,
        diselesaikanPada: new Date(),
      },
    });

    const batch = await tx.uploadBatch.findUniqueOrThrow({ where: { id: baris.uploadBatchId } });
    const sisaMenunggu = await tx.barisBermasalah.count({
      where: { uploadBatchId: baris.uploadBatchId, status: "Menunggu" },
    });
    await tx.uploadBatch.update({
      where: { id: baris.uploadBatchId },
      data: {
        jumlahBerhasil: batch.jumlahBerhasil + 1,
        jumlahPerluReview: sisaMenunggu,
        status: sisaMenunggu === 0 ? "Selesai" : "MenungguReview",
      },
    });

    if (input.ingat.klasifikasi) {
      await tx.kamusKoreksi.upsert({
        where: { jenisField_kunciMentah: { jenisField: "Klasifikasi", kunciMentah: kunciKlasifikasi(rawRow) } },
        create: {
          jenisField: "Klasifikasi",
          kunciMentah: kunciKlasifikasi(rawRow),
          nilaiResolusi: input.kelompok,
          dibuatOlehId: input.diselesaikanOlehId,
        },
        update: { nilaiResolusi: input.kelompok },
      });
    }
    if (input.ingat.kategoriAkademisiLuar && input.data.kategoriAkademisiLuarKode) {
      await tx.kamusKoreksi.upsert({
        where: {
          jenisField_kunciMentah: {
            jenisField: "KategoriAkademisiLuar",
            kunciMentah: kunciKategoriAkademisiLuar(rawRow),
          },
        },
        create: {
          jenisField: "KategoriAkademisiLuar",
          kunciMentah: kunciKategoriAkademisiLuar(rawRow),
          nilaiResolusi: input.data.kategoriAkademisiLuarKode,
          dibuatOlehId: input.diselesaikanOlehId,
        },
        update: { nilaiResolusi: input.data.kategoriAkademisiLuarKode },
      });
    }
    if (input.ingat.statusKepegawaian) {
      await tx.kamusKoreksi.upsert({
        where: {
          jenisField_kunciMentah: {
            jenisField: "StatusKepegawaian",
            kunciMentah: kunciStatusKepegawaian(rawRow),
          },
        },
        create: {
          jenisField: "StatusKepegawaian",
          kunciMentah: kunciStatusKepegawaian(rawRow),
          nilaiResolusi: input.data.statusKepegawaianKode,
          dibuatOlehId: input.diselesaikanOlehId,
        },
        update: { nilaiResolusi: input.data.statusKepegawaianKode },
      });
    }
    if (input.ingat.golongan && input.data.golonganKode) {
      await tx.kamusKoreksi.upsert({
        where: { jenisField_kunciMentah: { jenisField: "Golongan", kunciMentah: kunciGolongan(rawRow) } },
        create: {
          jenisField: "Golongan",
          kunciMentah: kunciGolongan(rawRow),
          nilaiResolusi: input.data.golonganKode,
          dibuatOlehId: input.diselesaikanOlehId,
        },
        update: { nilaiResolusi: input.data.golonganKode },
      });
    }
    const jenisFieldJab = jenisFieldJabatan(input.data);
    const kodeJab = jabatanKodeUntukKamus(input.data);
    if (input.ingat.jabatan && jenisFieldJab && kodeJab) {
      await tx.kamusKoreksi.upsert({
        where: { jenisField_kunciMentah: { jenisField: jenisFieldJab, kunciMentah: kunciJabatan(rawRow) } },
        create: {
          jenisField: jenisFieldJab,
          kunciMentah: kunciJabatan(rawRow),
          nilaiResolusi: kodeJab,
          dibuatOlehId: input.diselesaikanOlehId,
        },
        update: { nilaiResolusi: kodeJab },
      });
    }
    if (input.ingat.unitKerja) {
      await tx.kamusKoreksi.upsert({
        where: { jenisField_kunciMentah: { jenisField: "UnitKerja", kunciMentah: kunciUnitKerja(rawRow) } },
        create: {
          jenisField: "UnitKerja",
          kunciMentah: kunciUnitKerja(rawRow),
          nilaiResolusi: input.data.unitAsalKode,
          dibuatOlehId: input.diselesaikanOlehId,
        },
        update: { nilaiResolusi: input.data.unitAsalKode },
      });
    }
    if (input.ingat.jabatanTambahan && jabatanTambahan) {
      const nilai = encodeJabatanTambahan(jabatanTambahan);
      await tx.kamusKoreksi.upsert({
        where: {
          jenisField_kunciMentah: { jenisField: "JabatanTambahan", kunciMentah: kunciJabatanTambahan(rawRow) },
        },
        create: {
          jenisField: "JabatanTambahan",
          kunciMentah: kunciJabatanTambahan(rawRow),
          nilaiResolusi: nilai,
          dibuatOlehId: input.diselesaikanOlehId,
        },
        update: { nilaiResolusi: nilai },
      });
    }

    await tx.auditLog.create({
      data: {
        aksi: "ResolveBarisBermasalah",
        entitas: "BarisBermasalah",
        entitasId: baris.id,
        detail: { nip: baris.nip, kelompok: input.kelompok, ingat: input.ingat },
        dilakukanOlehId: input.diselesaikanOlehId,
      },
    });
  });
}
