import Link from "next/link";
import { Suspense } from "react";
import { primaryButtonClass, textButtonClass } from "@/components/ui";
import { signOut } from "../login/actions";
import { Nav } from "./nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="flex flex-col gap-3 bg-surface p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:gap-5 md:p-5">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            finance-bet
          </Link>
          <form action={signOut} className="md:hidden">
            <button type="submit" className={textButtonClass}>
              Sair
            </button>
          </form>
        </div>
        <Link
          href="/lancamentos/novo"
          className={`${primaryButtonClass} hidden md:inline-flex`}
        >
          Novo lançamento
        </Link>
        <Suspense fallback={<div className="h-9" />}>
          <Nav />
        </Suspense>
        <form action={signOut} className="mt-auto hidden md:block">
          <button type="submit" className={textButtonClass}>
            Sair
          </button>
        </form>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-24 md:p-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>

      <Link
        href="/lancamentos/novo"
        className={`${primaryButtonClass} fixed inset-x-4 bottom-4 py-3 shadow-lg md:hidden`}
      >
        Novo lançamento
      </Link>
    </div>
  );
}
