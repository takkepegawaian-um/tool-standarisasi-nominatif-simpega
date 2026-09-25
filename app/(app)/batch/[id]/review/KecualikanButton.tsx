"use client";

import { useActionState, useState } from "react";
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
  const [permanen, setPermanen] = useState(false);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const pesan = permanen
          ? `Kecualikan NIP ${nip} PERMANEN? NIP ini akan otomatis di-skip total (tidak masuk arsip maupun review) di SEMUA upload bulan berikutnya - pakai ini kalau memang sudah pensiun/data sampah, bukan sekadar kurang lengkap bulan ini. Bisa dibatalkan lagi lewat halaman Kamus Koreksi.`
          : `Kecualikan baris NIP ${nip} dari arsip bulan ini? Tindakan ini tidak bisa dibatalkan (pakai ini kalau baris genuinely tidak bisa diselesaikan, mis. nama kosong total tanpa jejak di bulan manapun).`;
        if (!confirm(pesan)) e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <label className="flex items-center gap-1 text-xs text-slate-500">
        <input
          type="checkbox"
          name="permanen"
          checked={permanen}
          onChange={(e) => setPermanen(e.target.checked)}
        />
        Permanen (pensiun/sampah)
      </label>
      <TombolKecualikan />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
