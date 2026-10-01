import { cariKandidatIdentitasMirip } from "./identitasEksternal";

export type PegawaiRingkas = {
  nip: string;
  nama: string;
  jenisPegawai: string;
  status: string;
  unitKerja: string;
};

export type PasanganNipBerubah = {
  hilang: PegawaiRingkas;
  baru: PegawaiRingkas;
  skor: number;
};

export type HasilBandingkan = {
  orangBaru: PegawaiRingkas[];
  orangHilang: PegawaiRingkas[];
  kemungkinanBerubah: PasanganNipBerubah[];
};

export const AMBANG_SKOR_NIP_BERUBAH = 0.7;

/**
 * Bandingkan 2 daftar pegawai (biasanya 2 batch berbeda) murni berdasar NIP, lalu coba pasangkan
 * "orang hilang" dgn "orang baru" yang nama-nya sangat mirip (kemungkinan orang yang sama, NIP-nya
 * berubah - bisa krn placeholder SIMPEGA, bisa krn sebab lain spt typo dibetulkan). Pemasangan
 * GREEDY: pasangan skor tertinggi diambil dulu, supaya 1 orang tidak "diklaim" lebih dari sekali.
 * Sisanya (tidak terpasangkan) tetap dianggap benar-benar baru/benar-benar hilang.
 */
export function bandingkanDaftarPegawai(
  daftarA: PegawaiRingkas[],
  daftarB: PegawaiRingkas[]
): HasilBandingkan {
  const nipA = new Set(daftarA.map((p) => p.nip));
  const nipB = new Set(daftarB.map((p) => p.nip));

  const hilangMentah = daftarA.filter((p) => !nipB.has(p.nip));
  const baruMentah = daftarB.filter((p) => !nipA.has(p.nip));
  const baruByNip = new Map(baruMentah.map((p) => [p.nip, p]));
  const hilangByNip = new Map(hilangMentah.map((p) => [p.nip, p]));

  type Pasangan = { nipHilang: string; nipBaru: string; skor: number };
  const semuaPasangan: Pasangan[] = [];
  for (const h of hilangMentah) {
    const kandidat = cariKandidatIdentitasMirip(h.nama, baruMentah, baruMentah.length || 1);
    for (const k of kandidat) {
      if (k.skor >= AMBANG_SKOR_NIP_BERUBAH) {
        semuaPasangan.push({ nipHilang: h.nip, nipBaru: k.nip, skor: k.skor });
      }
    }
  }
  semuaPasangan.sort((a, b) => b.skor - a.skor);

  const hilangTerpakai = new Set<string>();
  const baruTerpakai = new Set<string>();
  const kemungkinanBerubah: PasanganNipBerubah[] = [];
  for (const p of semuaPasangan) {
    if (hilangTerpakai.has(p.nipHilang) || baruTerpakai.has(p.nipBaru)) continue;
    const hilangOrang = hilangByNip.get(p.nipHilang);
    const baruOrang = baruByNip.get(p.nipBaru);
    if (!hilangOrang || !baruOrang) continue;
    kemungkinanBerubah.push({ hilang: hilangOrang, baru: baruOrang, skor: p.skor });
    hilangTerpakai.add(p.nipHilang);
    baruTerpakai.add(p.nipBaru);
  }

  return {
    orangBaru: baruMentah.filter((p) => !baruTerpakai.has(p.nip)),
    orangHilang: hilangMentah.filter((p) => !hilangTerpakai.has(p.nip)),
    kemungkinanBerubah,
  };
}
