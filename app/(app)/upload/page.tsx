"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

import { NAMA_BULAN } from "@/lib/constants";

import { processUploadedNominatif } from "./actions";

const now = new Date();

export default function UploadPage() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "mengunggah" | "memproses">("idle");
  const [progress, setProgress] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const pending = status !== "idle";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const bulan = Number(formData.get("bulan"));
    const tahun = Number(formData.get("tahun"));
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("File belum dipilih.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("File harus berformat .xlsx.");
      return;
    }

    try {
      setStatus("mengunggah");
      setProgress(0);
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload-token",
        // Wajib multipart: default-nya SATU request PUT besar - di koneksi lambat/tidak stabil
        // (kasus nyata: kantor SDM), sekali putus di menit ke-2 langsung "Failed to fetch" dan
        // seluruh 4,5MB harus diulang dari nol. Multipart memecah jadi beberapa bagian yang
        // di-retry independen kalau gagal, jauh lebih tahan koneksi jelek.
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      setStatus("memproses");
      const result = await processUploadedNominatif(bulan, tahun, blob.url, file.name);
      if (result?.error) {
        setError(result.error);
        setStatus("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah file.");
      setStatus("idle");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Upload Nominatif Bulanan</h1>
        <p className="text-sm text-slate-500">
          Upload 1 file export mentah SIMPEGA ("DataPNSPTT_[Bulan][Tahun].xlsx") untuk bulan
          yang dipilih. Sistem akan mengklasifikasikan &amp; memetakan tiap baris secara
          otomatis; baris yang tidak bisa dipetakan dengan yakin akan ditandai untuk direview
          manual.
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bulan" className="block text-sm font-medium text-slate-700">
              Bulan
            </label>
            <select
              id="bulan"
              name="bulan"
              defaultValue={now.getMonth() + 1}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {NAMA_BULAN.map((nama, idx) => (
                <option key={nama} value={idx + 1}>
                  {nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tahun" className="block text-sm font-medium text-slate-700">
              Tahun
            </label>
            <input
              id="tahun"
              name="tahun"
              type="number"
              defaultValue={now.getFullYear()}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="file" className="block text-sm font-medium text-slate-700">
            File Excel Mentah
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
        </div>

        {status === "mengunggah" && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sidebar transition-all"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{Math.round(progress)}% terunggah</p>
          </div>
        )}

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-lighter disabled:opacity-50"
        >
          {status === "mengunggah"
            ? "Mengunggah file..."
            : status === "memproses"
              ? "Memproses..."
              : "Upload & Proses"}
        </button>
      </form>
    </div>
  );
}
