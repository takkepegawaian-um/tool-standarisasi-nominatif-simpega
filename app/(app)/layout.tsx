import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";

import { Sidebar } from "./Sidebar";

// Upload memproses ~2.400 baris secara sinkron dalam 1 request (bisa >60 detik) - default
// Vercel Hobby cuma 60 detik & tidak bisa diperpanjang lewat config ini, Pro bisa sampai
// 300an detik (lebih lagi dengan Fluid Compute). Kalau upload masih timeout di Hobby, satu
// baris ini tidak cukup - proses upload perlu dipindah ke background job.
export const maxDuration = 300;

async function doSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar
        userName={session.user.name ?? "Admin"}
        userEmail={session.user.email ?? ""}
        onSignOut={doSignOut}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
