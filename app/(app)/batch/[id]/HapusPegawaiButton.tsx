"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { hapusNominatifBulanan, type HapusPegawaiState } from "./pegawaiActions";

function TombolHapus() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Menghapus..." : "Hapus"}
    </button>
  );
}

export function HapusPegawaiButton({
  batchId,
  nominatifBulananId,
  nama,
}: {
  batchId: string;
  nominatifBulananId: string;
  nama: string;
}) {
  const boundAction = hapusNominatifBulanan.bind(null, batchId, nominatifBulananId);
  const [state, formAction] = useActionState<HapusPegawaiState, FormData>(boundAction, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Hapus "${nama}" dari bulan ini? Tindakan ini tidak bisa dibatalkan.`)) {
          e.preventDefault();
        }
      }}
    >
      <TombolHapus />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.sukses && <p className="mt-1 text-xs text-emerald-600">{state.sukses}</p>}
    </form>
  );
}
