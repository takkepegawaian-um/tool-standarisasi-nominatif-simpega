import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

// File mentah SIMPEGA bisa >4.5MB (2.400+ baris x 85+ kolom) - di atas batas keras platform
// Vercel utk body request Server Action/Route Handler. Jalur ini cuma menandatangani izin upload
// LANGSUNG dari browser ke Vercel Blob (byte file tidak pernah lewat function ini sama sekali),
// baru sesudahnya server action memproses via URL blob-nya.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesi login sudah habis." }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.toLowerCase().endsWith(".xlsx")) {
          throw new Error("File harus berformat .xlsx.");
        }
        return {
          allowedContentTypes: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 25 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // Tidak ada aksi di sini - pemrosesan sebenarnya (parse + klasifikasi + simpan DB)
        // dipicu langsung oleh client setelah upload selesai, lihat app/(app)/upload/actions.ts.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat izin upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
