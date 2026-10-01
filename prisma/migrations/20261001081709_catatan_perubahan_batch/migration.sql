-- CreateTable
CREATE TABLE "catatan_perubahan_batch" (
    "id" TEXT NOT NULL,
    "uploadBatchAId" TEXT NOT NULL,
    "uploadBatchBId" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "nipUtama" TEXT NOT NULL,
    "nipTerkait" JSONB,
    "nama" TEXT NOT NULL,
    "alasan" TEXT NOT NULL,
    "dibuatOlehId" TEXT NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbaruiPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catatan_perubahan_batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catatan_perubahan_batch_uploadBatchAId_uploadBatchBId_kateg_key" ON "catatan_perubahan_batch"("uploadBatchAId", "uploadBatchBId", "kategori", "nipUtama");

-- AddForeignKey
ALTER TABLE "catatan_perubahan_batch" ADD CONSTRAINT "catatan_perubahan_batch_uploadBatchAId_fkey" FOREIGN KEY ("uploadBatchAId") REFERENCES "upload_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catatan_perubahan_batch" ADD CONSTRAINT "catatan_perubahan_batch_uploadBatchBId_fkey" FOREIGN KEY ("uploadBatchBId") REFERENCES "upload_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catatan_perubahan_batch" ADD CONSTRAINT "catatan_perubahan_batch_dibuatOlehId_fkey" FOREIGN KEY ("dibuatOlehId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
