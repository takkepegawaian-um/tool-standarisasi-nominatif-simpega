import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import jenisPegawai from "./seed-data/jenisPegawai.json";
import statusKepegawaian from "./seed-data/statusKepegawaian.json";
import golongan from "./seed-data/golongan.json";
import jabatanFungsionalDosen from "./seed-data/jabatanFungsionalDosen.json";
import jabatanFungsionalTendik from "./seed-data/jabatanFungsionalTendik.json";
import jabatanFungsiUmumPelaksana from "./seed-data/jabatanFungsiUmumPelaksana.json";
import jabatanTambahanRole from "./seed-data/jabatanTambahanRole.json";
import unitInduk from "./seed-data/unitInduk.json";
import unitAsal from "./seed-data/unitAsal.json";
import programStudi from "./seed-data/programStudi.json";
import kategoriAkademisiLuar from "./seed-data/kategoriAkademisiLuar.json";

const prisma = new PrismaClient();

async function main() {
  // SQLite tidak dukung `skipDuplicates` pada createMany, jadi pakai upsert per-baris.
  // Dataset master kecil (maks ~180 baris) sehingga tidak masalah dari sisi performa,
  // dan pola ini portable ke Postgres tanpa perubahan. Urutan mengikuti dependensi FK
  // (unit induk sebelum unit asal, unit asal sebelum program studi, dst).
  for (const row of jenisPegawai) {
    await prisma.jenisPegawai.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of statusKepegawaian) {
    await prisma.statusKepegawaian.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of golongan) {
    await prisma.golongan.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of jabatanFungsionalDosen) {
    await prisma.jabatanFungsionalDosen.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of jabatanFungsionalTendik) {
    await prisma.jabatanFungsionalTendik.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of jabatanFungsiUmumPelaksana) {
    await prisma.jabatanFungsiUmumPelaksana.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of jabatanTambahanRole) {
    await prisma.jabatanTambahanRole.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of unitInduk) {
    await prisma.unitInduk.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of unitAsal) {
    await prisma.unitAsal.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of programStudi) {
    await prisma.programStudi.upsert({ where: { kode: row.kode }, create: row, update: row });
  }
  for (const row of kategoriAkademisiLuar) {
    await prisma.kategoriAkademisiLuar.upsert({ where: { kode: row.kode }, create: row, update: row });
  }

  const email = "admin@simpega.um.ac.id";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        nama: "Admin SDM",
        passwordHash: await bcrypt.hash("kdsone", 10),
      },
    });
    console.log(`Seeded admin user: ${email}`);
  }

  console.log("Seed selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
