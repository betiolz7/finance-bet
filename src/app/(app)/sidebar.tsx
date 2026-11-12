"use client";

import {
  ArrowLeftRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MAIN_NAV, SECONDARY_NAV, isActive, type NavItem } from "./navigation";

const STORAGE_KEY = "finance-bet:sidebar-collapsed";

// Preferência guardada no navegador. Sem acesso ao armazenamento, vale só
// para esta visita.
const listeners = new Set<() => void>();
let sessionValue: boolean | null = null;

function readCollapsed(): boolean {
  if (sessionValue !== null) return sessionValue;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  sessionValue = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Mantém apenas o valor desta visita.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Sidebar({
  reviewCount,
  signOutAction,
  children,
}: {
  reviewCount: number;
  signOutAction: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  function toggle() {
    writeCollapsed(!collapsed);
  }

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active =
      isActive(pathname, item.href) &&
      !item.children?.some((child) => isActive(pathname, child.href));
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] ${
            active ? "bg-soft font-medium text-ink" : "text-ink/80 hover:bg-soft/60"
          } ${collapsed ? "justify-center" : ""}`}
        >
          {active && (
            <span className="absolute inset-y-2 -left-3 w-1 rounded-r bg-ink" aria-hidden />
          )}
          <Icon className="size-5 shrink-0" strokeWidth={1.6} aria-hidden />
          {!collapsed && <span>{item.label}</span>}
        </Link>

        {item.children && !collapsed && (
          <ul className="mt-1 ml-[22px] border-l border-line pl-4">
            {item.children.map((child) => {
              const childActive = isActive(pathname, child.href);
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    aria-current={childActive ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${
                      childActive ? "bg-soft font-medium" : "text-ink/75 hover:text-ink"
                    }`}
                  >
                    {child.label}
                    {child.badge === "review" && reviewCount > 0 && (
                      <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold text-on-ink">
                        {reviewCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-surface py-6 md:flex ${
        collapsed ? "w-20 px-3" : "w-64 px-5"
      }`}
    >
      <Link
        href="/dashboard"
        className={`mb-6 text-xl font-bold tracking-tight ${collapsed ? "text-center" : "px-3"}`}
      >
        {collapsed ? "fb" : "finance-bet"}
      </Link>

      <nav className="no-scrollbar -mx-3 flex-1 overflow-y-auto px-3" aria-label="Menu principal">
        <ul className="space-y-1">{MAIN_NAV.map(renderItem)}</ul>
        <hr className="my-3 border-line" />
        <ul className="space-y-1">{SECONDARY_NAV.map(renderItem)}</ul>
      </nav>

      {!collapsed && children}

      <form action={signOutAction}>
        <button
          type="submit"
          title={collapsed ? "Sair" : undefined}
          className={`mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/80 hover:bg-soft/60 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="size-5" strokeWidth={1.6} aria-hidden />
          {!collapsed && "Sair"}
        </button>
      </form>
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/80 hover:bg-soft/60 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        {collapsed ? (
          <ChevronsRight className="size-5" strokeWidth={1.6} aria-label="Expandir menu" />
        ) : (
          <>
            <ChevronsLeft className="size-5" strokeWidth={1.6} aria-hidden />
            Recolher menu
          </>
        )}
      </button>
    </aside>
  );
}

const TAB_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  null, // espaço do botão central
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
];

const NEW_TRANSACTION = "/lancamentos/novo";

/** Barra inferior do celular, com o botão central elevado num recorte. */
export function MobileTabBar({
  reviewCount,
  signOutAction,
}: {
  reviewCount: number;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tabPaths = TAB_ITEMS.flatMap((item) => (item ? [item.href] : []));
  const centerActive = pathname === NEW_TRANSACTION;
  const moreActive =
    !centerActive && !tabPaths.some((href) => isActive(pathname, href));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const moreItems = [
    ...MAIN_NAV.flatMap((item) => [item, ...(item.children ?? [])]),
    ...SECONDARY_NAV,
  ].filter((item) => !tabPaths.includes(item.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-3 bottom-28 rounded-3xl bg-surface p-3 shadow-xl">
            <ul className="grid grid-cols-3 gap-1">
              {moreItems.map((item) => {
                const Icon = "icon" in item ? item.icon : null;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center text-xs ${
                        active ? "bg-soft font-medium" : "hover:bg-soft"
                      }`}
                    >
                      {Icon ? (
                        <Icon className="size-5" strokeWidth={1.6} aria-hidden />
                      ) : (
                        <span className="size-5" aria-hidden />
                      )}
                      {item.label}
                      {"badge" in item && item.badge === "review" && reviewCount > 0 && (
                        <span className="absolute top-2 right-3 rounded-full bg-ink px-1.5 text-[10px] font-semibold text-on-ink">
                          {reviewCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
              <li>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-xs hover:bg-soft"
                  >
                    <LogOut className="size-5" strokeWidth={1.6} aria-hidden />
                    Sair
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      )}

      <nav
        aria-label="Menu principal"
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 drop-shadow-[0_6px_18px_rgb(0_0_0/0.14)] md:hidden"
      >
        <div
          className="relative h-16 rounded-[22px] bg-surface"
          // Recorte em volta do botão central.
          style={{
            mask: "radial-gradient(circle at 50% 0, transparent 37px, #000 38px)",
            WebkitMask: "radial-gradient(circle at 50% 0, transparent 37px, #000 38px)",
          }}
        />
        <ul className="absolute inset-0 grid grid-cols-5 items-center">
          {TAB_ITEMS.map((item, index) =>
            item ? (
              <li key={item.href} className="flex justify-center">
                <TabLink
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={!centerActive && isActive(pathname, item.href)}
                />
              </li>
            ) : (
              <li key={`center-${index}`} className="flex justify-center">
                <Link
                  href={NEW_TRANSACTION}
                  aria-label="Novo lançamento"
                  aria-current={centerActive ? "page" : undefined}
                  className="relative -top-7 flex size-14 items-center justify-center rounded-full bg-bar-income text-white shadow-lg"
                >
                  <Plus className="size-6" strokeWidth={2} aria-hidden />
                  {centerActive && (
                    <span className="absolute -bottom-3 size-1.5 rounded-full bg-income" aria-hidden />
                  )}
                </Link>
              </li>
            ),
          )}
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              aria-label="Mais opções"
              className={`relative flex size-12 flex-col items-center justify-center ${
                open || moreActive ? "text-income" : "text-muted"
              }`}
            >
              <Menu className="size-[22px]" strokeWidth={1.6} aria-hidden />
              {(open || moreActive) && (
                <span className="absolute bottom-1 size-1.5 rounded-full bg-income" aria-hidden />
              )}
              {reviewCount > 0 && (
                <span className="absolute top-2 right-2 size-2 rounded-full bg-expense" aria-hidden />
              )}
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex size-12 items-center justify-center ${
        active ? "text-income" : "text-muted"
      }`}
    >
      <Icon className="size-[22px]" strokeWidth={1.6} aria-hidden />
      {active && (
        <span className="absolute bottom-1 size-1.5 rounded-full bg-income" aria-hidden />
      )}
    </Link>
  );
}
