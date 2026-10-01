"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JENIS_FIELD_IDENTITAS_EKSTERNAL, kunciIdentitasEksternal } from "@/lib/domain/identitasEksternal";
import type { RawNominatifRow } from "@/lib/excel/types";

export async function pilihIdentitasEksternal(
  batchId: string,
  barisId: string,
  formData: FormData
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesi login sudah habis, silakan masuk ulang.");

  const nipTerpilih = String(formData.get("nipTerpilih") ?? "").trim();
  if (!/^\d+$/.test(nipTerpilih)) throw new Error("NIP tidak valid.");

  const baris = await prisma.barisBermasalah.findUniqueOrThrow({ where: { id: barisId } });
  const raw = baris.dataMentah as unknown as RawNominatifRow;
  const namaMentah = raw.namaDenganGelar || raw.namaTanpaGelar;

  // Kalau admin memilih NIP LAMA (bukan placeholder baris ini sendiri), pastikan NIP itu memang
  // pernah tercatat - mencegah salah ketik NIP yang tidak ada riwayatnya sama sekali.
  if (nipTerpilih !== baris.nip) {
    const ada = await prisma.pegawai.findUnique({ where: { nip: nipTerpilih } });
    if (!ada) throw new Error(`NIP ${nipTerpilih} tidak ditemukan di riwayat pegawai manapun.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.kamusKoreksi.upsert({
      where: {
        jenisField_kunciMentah: {
          jenisField: JENIS_FIELD_IDENTITAS_EKSTERNAL,
          kunciMentah: kunciIdentitasEksternal(namaMentah),
        },
      },
      create: {
        jenisField: JENIS_FIELD_IDENTITAS_EKSTERNAL,
        kunciMentah: kunciIdentitasEksternal(namaMentah),
        nilaiResolusi: nipTerpilih,
        dibuatOlehId: session.user.id,
      },
      update: { nilaiResolusi: nipTerpilih },
    });

    await tx.auditLog.create({
      data: {
        aksi: "PilihIdentitasEksternal",
        entitas: "BarisBermasalah",
        entitasId: baris.id,
        detail: { nama: namaMentah, nipPlaceholder: baris.nip, nipDipilih: nipTerpilih },
        dilakukanOlehId: session.user.id,
      },
    });
  });

  redirect(`/batch/${batchId}/review/${barisId}`);
}
