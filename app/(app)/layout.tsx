import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";

// Upload memproses ~2.400 baris secara sinkron dalam 1 request (bisa >60 detik) - default
// Vercel Hobby cuma 60 detik & tidak bisa diperpanjang lewat config ini, Pro bisa sampai
// 300an detik (lebih lagi dengan Fluid Compute). Kalau upload masih timeout di Hobby, satu
// baris ini tidak cukup - proses upload perlu dipindah ke background job.
export const maxDuration = 300;

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/arsip", label: "Arsip" },
  { href: "/kamus", label: "Kamus Koreksi" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Tool Standardisasi Nominatif
            </p>
            <p className="text-xs text-slate-500">SIMPEGA UM</p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
