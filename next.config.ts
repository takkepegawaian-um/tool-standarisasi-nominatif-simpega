import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default Server Actions cuma 1MB - file export mentah SIMPEGA (~2.400 baris x 85+ kolom)
  // bisa >4.5MB. Kasih ruang lebih (10MB) utk jaga-jaga file makin besar seiring pegawai bertambah.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
