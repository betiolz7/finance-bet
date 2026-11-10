"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lancamentos", label: "Lançamentos" },
  { href: "/custos-fixos", label: "Custos fixos" },
  { href: "/importar", label: "Importar planilha" },
  { href: "/open-finance", label: "Open Finance" },
  { href: "/cartoes", label: "Cartões" },
  { href: "/orcamento", label: "Orçamento" },
  { href: "/metas", label: "Metas" },
  { href: "/contas", label: "Contas" },
  { href: "/categorias", label: "Categorias" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-canvas text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
