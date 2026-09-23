"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { STATUS_PENGANGKATAN } from "@/lib/constants";
import type { RawNominatifRow } from "@/lib/excel/types";

import { resolveBarisBermasalah, type ResolveState } from "./actions";
import { SearchableSelect } from "./SearchableSelect";

type Master = {
  statusKepegawaian: { kode: string; nama: string }[];
  golongan: { kode: string }[];
  jabatanFungsionalDosen: { kode: string; nama: string }[];
  jabatanFungsionalTendik: { kode: string; jabatanPokok: string; jenjang: string }[];
  jabatanFungsiUmumPelaksana: { kode: string; nama: string }[];
  kategoriAkademisiLuar: { kode: string; nama: string }[];
  unitAsal: { kode: string; nama: string }[];
  jabatanTambahanRole: { kode: string; namaRole: string; berlakuUntuk: string }[];
  programStudi: { kode: string; nama: string }[];
};

type Prefill = {
  kelompok: "Dosen" | "Tendik" | "Akademisi Luar UM" | null;
  statusKepegawaianKode: string | null;
  golonganKode: string | null;
  kategoriAkademisiLuarKode: string | null;
  jabatanPilihan: string | null;
  unitAsalKode: string | null;
  adaJabatanTambahan: boolean;
  jabatanTambahanRoleKode: string | null;
  jabatanTambahanTargetKode: string | null;
  statusPengangkatan: string | null;
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-lighter disabled:opacity-50"
    >
      {pending ? "Menyimpan..." : "Simpan & Lanjut"}
    </button>
  );
}

export function ResolveForm({
  batchId,
  barisId,
  raw,
  prefill,
  master,
}: {
  batchId: string;
  barisId: string;
  raw: RawNominatifRow;
  prefill: Prefill;
  master: Master;
}) {
  const boundAction = resolveBarisBermasalah.bind(null, batchId, barisId);
  const [state, formAction] = useActionState<ResolveState, FormData>(boundAction, {});
  const [kelompok, setKelompok] = useState(prefill.kelompok ?? "Tendik");
  const [adaJabatanTambahan, setAdaJabatanTambahan] = useState(prefill.adaJabatanTambahan);

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Kelompok Pegawai</legend>
        <div className="mt-2 flex gap-4">
          {(["Dosen", "Tendik", "Akademisi Luar UM"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="kelompok"
                value={k}
                checked={kelompok === k}
                onChange={() => setKelompok(k)}
              />
              {k}
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" name="ingatKlasifikasi" />
          Ingat klasifikasi ini untuk kombinasi Jenis Pegawai/Status Pegawai yang sama bulan berikutnya
        </label>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nama</label>
          <input
            name="nama"
            defaultValue={raw.namaDenganGelar || raw.namaTanpaGelar}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Jenis Kelamin</label>
          <select
            name="jenisKelamin"
            defaultValue={raw.jenisKelaminRaw === "L" || raw.jenisKelaminRaw === "P" ? raw.jenisKelaminRaw : ""}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Pilih
            </option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Tanggal Lahir</label>
          <input
            type="date"
            name="tanggalLahir"
            defaultValue={toDateInputValue(raw.tanggalLahir as unknown as string)}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Tanggal Mulai Kerja (TMT)</label>
          <input
            type="date"
            name="tanggalMulaiKerja"
            defaultValue={toDateInputValue(raw.tanggalMasuk as unknown as string)}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Pendidikan Terakhir (opsional)</label>
          <input
            name="pendidikanTerakhir"
            defaultValue={raw.pendidikanRaw}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Agama (opsional)</label>
          <input
            name="agama"
            defaultValue={raw.agamaRaw}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {kelompok === "Akademisi Luar UM" ? (
        <div>
          <label className="block text-sm font-medium text-slate-700">Kategori Akademisi Luar</label>
          <select
            name="kategoriAkademisiLuarKode"
            defaultValue={prefill.kategoriAkademisiLuarKode ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Pilih kategori...</option>
            {master.kategoriAkademisiLuar.map((k) => (
              <option key={k.kode} value={k.kode}>
                {k.nama}
              </option>
            ))}
          </select>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" name="ingatKategori" />
            Ingat kategori ini untuk nilai mentah yang sama bulan berikutnya
          </label>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700">Status Kepegawaian</label>
            <select
              name="statusKepegawaianKode"
              defaultValue={prefill.statusKepegawaianKode ?? ""}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Pilih status...</option>
              {master.statusKepegawaian.map((s) => (
                <option key={s.kode} value={s.kode}>
                  {s.nama} ({s.kode})
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" name="ingatStatus" />
              Ingat status ini untuk nilai Status Pegawai mentah yang sama bulan berikutnya
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Golongan (kosongkan untuk Non-ASN)
            </label>
            <select
              name="golonganKode"
              defaultValue={prefill.golonganKode ?? ""}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">(kosong / Non-ASN)</option>
              {master.golongan.map((g) => (
                <option key={g.kode} value={g.kode}>
                  {g.kode}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" name="ingatGolongan" />
              Ingat golongan ini untuk teks Golongan Pangkat mentah yang sama bulan berikutnya
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Jabatan Fungsional / Fungsi</label>
            <SearchableSelect
              key={kelompok}
              name="jabatanPilihan"
              defaultValue={prefill.jabatanPilihan ?? ""}
              placeholder="Cari jabatan fungsional/fungsi..."
              options={
                kelompok === "Dosen"
                  ? master.jabatanFungsionalDosen.map((j) => ({
                      value: `DOSEN:${j.kode}`,
                      label: j.nama,
                      group: "Jabatan Fungsional Dosen",
                    }))
                  : [
                      ...master.jabatanFungsionalTendik.map((j) => ({
                        value: `TENDIK:${j.kode}`,
                        label: j.jenjang === "-" ? j.jabatanPokok : `${j.jabatanPokok} ${j.jenjang}`,
                        group: "Jabatan Fungsional Tendik",
                      })),
                      ...master.jabatanFungsiUmumPelaksana.map((j) => ({
                        value: `UMUM:${j.kode}`,
                        label: j.nama,
                        group: "Fungsi Umum Pelaksana",
                      })),
                    ]
              }
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" name="ingatJabatan" />
              Ingat jabatan ini untuk teks Jabatan Fungsional mentah yang sama bulan berikutnya
            </label>
          </div>
        </>
      )}

      {kelompok !== "Akademisi Luar UM" && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="adaJabatanTambahan"
              checked={adaJabatanTambahan}
              onChange={(e) => setAdaJabatanTambahan(e.target.checked)}
            />
            Punya Jabatan Tambahan
          </label>

          {adaJabatanTambahan && (
            <div className="mt-3 space-y-3 rounded-md border border-slate-200 p-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Jabatan Tambahan</label>
                <SearchableSelect
                  key={kelompok}
                  name="jabatanTambahanRoleKode"
                  defaultValue={prefill.jabatanTambahanRoleKode ?? ""}
                  placeholder="Cari jabatan tambahan..."
                  options={master.jabatanTambahanRole
                    .filter((r) => r.berlakuUntuk === "Keduanya" || r.berlakuUntuk === kelompok)
                    .map((r) => ({ value: r.kode, label: r.namaRole }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Unit/Prodi Jabatan Tambahan
                </label>
                <SearchableSelect
                  name="jabatanTambahanTargetKode"
                  defaultValue={prefill.jabatanTambahanTargetKode ?? ""}
                  placeholder="Cari unit/prodi..."
                  options={[
                    ...master.unitAsal.map((u) => ({
                      value: `UNIT:${u.kode}`,
                      label: u.nama,
                      group: "Unit Asal",
                    })),
                    ...master.programStudi.map((p) => ({
                      value: `PRODI:${p.kode}`,
                      label: p.nama,
                      group: "Program Studi",
                    })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Status Pengangkatan</label>
                <select
                  name="statusPengangkatan"
                  defaultValue={prefill.statusPengangkatan ?? ""}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih status pengangkatan...</option>
                  {STATUS_PENGANGKATAN.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Tidak ada sinyalnya di data sumber - selalu perlu dipilih manual.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" name="ingatJabatanTambahan" />
                Ingat resolusi ini (role + unit/prodi + status) untuk teks Jabatan Tambahan mentah
                yang sama bulan berikutnya
              </label>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">Unit Kerja</label>
        <SearchableSelect
          name="unitAsalKode"
          defaultValue={prefill.unitAsalKode ?? ""}
          placeholder="Cari unit kerja..."
          options={master.unitAsal.map((u) => ({ value: u.kode, label: u.nama }))}
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" name="ingatUnit" />
          Ingat unit kerja ini untuk nilai mentah yang sama bulan berikutnya
        </label>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
