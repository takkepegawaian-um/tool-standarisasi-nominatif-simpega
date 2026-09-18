import { prisma } from "../lib/db";

async function main() {
  const batch = await prisma.uploadBatch.findFirst({ orderBy: { diunggahPada: "desc" } });
  console.log("Batch:", batch);

  const akl = await prisma.nominatifBulanan.findMany({
    where: { jenisPegawaiKode: "AKL" },
    take: 3,
    include: { kategoriAkademisiLuar: true, statusKepegawaian: true },
  });
  console.log("Contoh AKL berhasil:", JSON.stringify(akl, null, 2));

  const jumlahAkl = await prisma.nominatifBulanan.count({ where: { jenisPegawaiKode: "AKL" } });
  console.log("Total AKL berhasil:", jumlahAkl);

  const totalNominatif = await prisma.nominatifBulanan.count();
  const totalBermasalah = await prisma.barisBermasalah.count();
  console.log({ totalNominatif, totalBermasalah, jumlahSeharusnya: batch?.jumlahBarisTotal });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
