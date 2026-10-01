"use client";

import { useState } from "react";

import type { PasanganNipBerubah, PegawaiRingkas } from "@/lib/domain/bandingkanBatch";

type PasanganDenganBadge = PasanganNipBerubah & { sudahTercatat: boolean; polaPlaceholder: boolean };

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-sidebar text-sidebar"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function TabelPegawai({ data, labelKosong }: { data: PegawaiRingkas[]; labelKosong: string }) {
  if (data.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">{labelKosong}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">NIP</th>
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Jenis Pegawai</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Unit Kerja</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((p) => (
            <tr key={p.nip}>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.nip}</td>
              <td className="px-4 py-3 text-slate-900">{p.nama}</td>
              <td className="px-4 py-3 text-slate-600">{p.jenisPegawai}</td>
              <td className="px-4 py-3 text-slate-600">{p.status}</td>
              <td className="px-4 py-3 text-slate-600">{p.unitKerja}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelNipBerubah({
  data,
  labelA,
  labelB,
}: {
  data: PasanganDenganBadge[];
  labelA: string;
  labelB: string;
}) {
  if (data.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        Tidak ada pasangan nama mirip (kemiripan ≥ 70%) antara orang hilang & orang baru.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">{`NIP di ${labelA}`}</th>
            <th className="px-4 py-3">{`NIP di ${labelB}`}</th>
            <th className="px-4 py-3">Kemiripan</th>
            <th className="px-4 py-3">Keterangan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((p) => (
            <tr key={`${p.hilang.nip}-${p.baru.nip}`}>
              <td className="px-4 py-3 text-slate-900">{p.baru.nama}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.hilang.nip}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.baru.nip}</td>
              <td className="px-4 py-3 text-slate-600">{Math.round(p.skor * 100)}%</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {p.polaPlaceholder && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      NIP placeholder SIMPEGA
                    </span>
                  )}
                  {p.sudahTercatat ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      Sudah distabilkan di Kamus
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Belum tercatat di Kamus
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BandingkanTabs({
  labelA,
  labelB,
  orangBaru,
  orangHilang,
  kemungkinanBerubah,
}: {
  labelA: string;
  labelB: string;
  orangBaru: PegawaiRingkas[];
  orangHilang: PegawaiRingkas[];
  kemungkinanBerubah: PasanganDenganBadge[];
}) {
  const [tab, setTab] = useState<"baru" | "hilang" | "berubah">("baru");

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex border-b border-slate-200">
        <TabButton active={tab === "baru"} onClick={() => setTab("baru")} label={`Orang Baru (${orangBaru.length})`} />
        <TabButton
          active={tab === "hilang"}
          onClick={() => setTab("hilang")}
          label={`Orang Hilang (${orangHilang.length})`}
        />
        <TabButton
          active={tab === "berubah"}
          onClick={() => setTab("berubah")}
          label={`Kemungkinan NIP Berubah (${kemungkinanBerubah.length})`}
        />
      </div>
      {tab === "baru" && <TabelPegawai data={orangBaru} labelKosong={`Tidak ada pegawai baru di ${labelB}.`} />}
      {tab === "hilang" && <TabelPegawai data={orangHilang} labelKosong={`Tidak ada pegawai hilang dari ${labelA}.`} />}
      {tab === "berubah" && <TabelNipBerubah data={kemungkinanBerubah} labelA={labelA} labelB={labelB} />}
    </div>
  );
}
