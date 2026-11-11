import {
  ArrowLeftRight,
  CreditCard,
  LayoutGrid,
  PiggyBank,
  Tags,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string; badge?: "review" }[];
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  {
    href: "/lancamentos",
    label: "Lançamentos",
    icon: ArrowLeftRight,
    children: [
      { href: "/custos-fixos", label: "Custos fixos" },
      { href: "/importar", label: "Importar planilha" },
      { href: "/open-finance", label: "Open Finance", badge: "review" },
    ],
  },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/orcamento", label: "Orçamento", icon: PiggyBank },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/contas", label: "Contas", icon: Wallet },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/categorias", label: "Categorias", icon: Tags },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
