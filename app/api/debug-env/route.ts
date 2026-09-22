import { NextResponse } from "next/server";

// SEMENTARA untuk diagnosis "MissingSecret" di produksi - cuma laporkan boolean/panjang
// string, tidak pernah nilai asli. Hapus setelah root cause ketemu.
export async function GET() {
  const authSecret = process.env.AUTH_SECRET;
  const databaseUrl = process.env.DATABASE_URL;
  return NextResponse.json({
    hasAuthSecret: Boolean(authSecret),
    authSecretLength: authSecret?.length ?? 0,
    hasDatabaseUrl: Boolean(databaseUrl),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercel: process.env.VERCEL,
    runtime: process.env.NEXT_RUNTIME,
  });
}
