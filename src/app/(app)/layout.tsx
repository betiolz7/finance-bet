import { Bell, Landmark, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { loadShellData } from "@/lib/shell";
import { signOut } from "../login/actions";
import { MobileTabBar, Sidebar } from "./sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      <Suspense fallback={<div className="hidden w-64 shrink-0 bg-surface md:block" />}>
        <SidebarWithData />
      </Suspense>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 px-4 py-4 md:px-8 md:py-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight md:hidden">
            finance-bet
          </Link>
          <form
            action="/lancamentos"
            role="search"
            className="hidden w-full max-w-sm items-center gap-2 rounded-xl bg-surface px-4 py-2.5 sm:flex"
          >
            <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
            <input
              name="busca"
              type="search"
              placeholder="Buscar lançamentos"
              aria-label="Buscar lançamentos"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </form>
          <Suspense fallback={<div className="ml-auto h-11" />}>
            <TopBarActions />
          </Suspense>
        </header>

        <main className="px-4 pb-32 md:px-8 md:pb-10">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>

      <Suspense fallback={null}>
        <MobileTabBarWithData />
      </Suspense>
    </div>
  );
}

async function MobileTabBarWithData() {
  const { reviewCount } = await loadShellData();
  return <MobileTabBar reviewCount={reviewCount} signOutAction={signOut} />;
}

async function SidebarWithData() {
  const { reviewCount } = await loadShellData();
  return (
    <Sidebar reviewCount={reviewCount} signOutAction={signOut}>
      {reviewCount > 0 && (
        <div className="mb-2 rounded-2xl border border-line p-4">
          <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-ink text-on-ink">
            <Landmark className="size-4" aria-hidden />
          </span>
          <p className="text-lg font-semibold leading-tight">
            {reviewCount} {reviewCount === 1 ? "transação" : "transações"} do banco
          </p>
          <p className="mt-1 text-sm text-ink/80">
            Revise para manter seus números certos.
          </p>
          <Link
            href="/open-finance/revisar"
            className="mt-4 flex justify-center rounded-xl bg-ink py-2.5 text-sm font-medium text-on-ink"
          >
            Revisar agora
          </Link>
        </div>
      )}
    </Sidebar>
  );
}

async function TopBarActions() {
  const { email, reviewCount } = await loadShellData();
  const initial = (email[0] ?? "?").toUpperCase();
  const iconButton =
    "relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface hover:bg-soft";

  return (
    <div className="ml-auto flex items-center gap-2">
      <ThemeToggle className={iconButton} />
      <Link
        href="/open-finance/revisar"
        className={iconButton}
        aria-label={
          reviewCount > 0
            ? `${reviewCount} transações do banco para revisar`
            : "Transações do banco"
        }
      >
        <Bell className="size-5" strokeWidth={1.6} aria-hidden />
        {reviewCount > 0 && (
          <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-expense" aria-hidden />
        )}
      </Link>
      <Link href="/categorias" className={iconButton} aria-label="Configurações">
        <Settings className="size-5" strokeWidth={1.6} aria-hidden />
      </Link>
      <div className="hidden items-center gap-2.5 rounded-xl bg-surface py-1.5 pr-4 pl-1.5 lg:flex">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-semibold">
          {initial}
        </span>
        <span className="max-w-48 truncate text-sm">{email}</span>
      </div>
      <Link
        href="/lancamentos/novo"
        className="hidden items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-medium hover:bg-soft md:flex"
      >
        <Plus className="size-4" aria-hidden />
        Novo lançamento
      </Link>
    </div>
  );
}
