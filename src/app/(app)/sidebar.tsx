"use client";

import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
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
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
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
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      childActive ? "bg-soft font-medium" : "text-ink/75 hover:text-ink"
                    }`}
                  >
                    {child.label}
                    {child.badge === "review" && reviewCount > 0 && (
                      <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white">
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
        className={`mb-8 text-xl font-bold tracking-tight ${collapsed ? "text-center" : "px-3"}`}
      >
        {collapsed ? "fb" : "finance-bet"}
      </Link>

      <nav className="flex-1 overflow-y-auto" aria-label="Menu principal">
        <ul className="space-y-1">{MAIN_NAV.map(renderItem)}</ul>
        <hr className="my-5 border-line" />
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

export function MobileNav() {
  const pathname = usePathname();
  const items = [
    ...MAIN_NAV.flatMap((item) => [
      { href: item.href, label: item.label },
      ...(item.children ?? []),
    ]),
    ...SECONDARY_NAV,
  ];
  return (
    <nav className="-mx-4 mb-4 overflow-x-auto px-4 md:hidden" aria-label="Menu principal">
      <ul className="flex gap-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                  active ? "bg-ink text-white" : "bg-surface text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
