-- CreateTable
CREATE TABLE "upload_chunk" (
    "uploadId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_chunk_pkey" PRIMARY KEY ("uploadId","chunkIndex")
);
