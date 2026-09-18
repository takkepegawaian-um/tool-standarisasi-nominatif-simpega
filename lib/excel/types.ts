export type RawNominatifRow = {
  nip: string;
  namaDenganGelar: string;
  namaTanpaGelar: string;
  jenisKelaminRaw: string;
  tanggalLahir: Date | null;
  agamaRaw: string;
  statusPegawaiRaw: string;
  jenisPegawaiRaw: string;
  kelompokJabatanRaw: string | null;
  golonganPangkatRaw: string;
  jabatanFungsionalRaw: string;
  jabatanTambahanRaw: string;
  pendidikanRaw: string;
  subagUnitKerjaRaw: string;
  unitKerjaIndukRaw: string;
  direktoratFakultasRaw: string;
  unitStatistikRaw: string;
  tanggalMasuk: Date | null;
};

export type ColumnMappingWarning = { pesan: string };

export type ParseRawNominatifResult = {
  rows: RawNominatifRow[];
  totalBarisSheet: number;
  petaKolomTerdeteksi: Record<string, number | null>;
};

export class ColumnMappingError extends Error {}
