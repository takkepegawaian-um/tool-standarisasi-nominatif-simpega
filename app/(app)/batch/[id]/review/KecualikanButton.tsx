"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { kecualikanBarisBermasalah, type KecualikanState } from "./kecualikanActions";

function TombolKecualikan() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
    >
      {pending ? "Memproses..." : "Kecualikan"}
    </button>
  );
}

export function KecualikanButton({
  batchId,
  barisBermasalahId,
  nip,
}: {
  batchId: string;
  barisBermasalahId: string;
  nip: string;
}) {
  const boundAction = kecualikanBarisBermasalah.bind(null, batchId, barisBermasalahId);
  const [state, formAction] = useActionState<KecualikanState, FormData>(boundAction, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Kecualikan baris NIP ${nip} dari arsip bulan ini? Tindakan ini tidak bisa dibatalkan (pakai ini kalau baris genuinely tidak bisa diselesaikan, mis. nama kosong total tanpa jejak di bulan manapun).`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <TombolKecualikan />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
