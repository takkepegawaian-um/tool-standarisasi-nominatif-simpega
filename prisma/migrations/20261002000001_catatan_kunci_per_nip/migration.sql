-- DropForeignKey
ALTER TABLE "catatan_perubahan_batch" DROP CONSTRAINT "catatan_perubahan_batch_uploadBatchAId_fkey";

-- DropForeignKey
ALTER TABLE "catatan_perubahan_batch" DROP CONSTRAINT "catatan_perubahan_batch_uploadBatchBId_fkey";

-- DropIndex
DROP INDEX "catatan_perubahan_batch_uploadBatchAId_uploadBatchBId_kateg_key";

-- AlterTable: kolom batch jadi konteks informatif saja (nullable), bukan bagian kunci unik lagi
ALTER TABLE "catatan_perubahan_batch" ALTER COLUMN "uploadBatchAId" DROP NOT NULL;
ALTER TABLE "catatan_perubahan_batch" ALTER COLUMN "uploadBatchBId" DROP NOT NULL;

-- CreateIndex: catatan sekarang melekat ke NIP-nya sendiri, bukan ke pasangan batch yg dibandingkan
CREATE UNIQUE INDEX "catatan_perubahan_batch_kategori_nipUtama_key" ON "catatan_perubahan_batch"("kategori", "nipUtama");

-- AddForeignKey
ALTER TABLE "catatan_perubahan_batch" ADD CONSTRAINT "catatan_perubahan_batch_uploadBatchAId_fkey" FOREIGN KEY ("uploadBatchAId") REFERENCES "upload_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catatan_perubahan_batch" ADD CONSTRAINT "catatan_perubahan_batch_uploadBatchBId_fkey" FOREIGN KEY ("uploadBatchBId") REFERENCES "upload_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
