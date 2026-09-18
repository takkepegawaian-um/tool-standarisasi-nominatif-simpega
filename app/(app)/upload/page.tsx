"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { NAMA_BULAN } from "@/lib/constants";

import { uploadNominatifBulanan, type UploadState } from "./actions";

const now = new Date();

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? "Memproses..." : "Upload & Proses"}
    </button>
  );
}

export default function UploadPage() {
  const [state, formAction] = useActionState<UploadState, FormData>(uploadNominatifBulanan, {});

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

      <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
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

        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
