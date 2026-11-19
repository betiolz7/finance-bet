"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "../navigation";
import { SETTINGS_TABS } from "./tabs";

/** Abas de Configurações. A de Open Finance mostra quantas transações faltam revisar. */
export function SettingsTabs({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções de configurações"
      className="no-scrollbar mb-6 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1"
    >
      {SETTINGS_TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
              active ? "bg-ink font-medium text-on-ink" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.badge === "review" && reviewCount > 0 && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                  active ? "bg-on-ink text-ink" : "bg-ink text-on-ink"
                }`}
              >
                {reviewCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
