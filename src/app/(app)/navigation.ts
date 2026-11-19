import {
  ArrowLeftRight,
  CreditCard,
  LayoutGrid,
  PiggyBank,
  Repeat,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { SETTINGS_PATHS } from "./(configuracoes)/tabs";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "review";
  /** Outras páginas que também deixam este item marcado no menu. */
  matches?: string[];
  children?: { href: string; label: string; badge?: "review" }[];
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/assistente", label: "Assistente", icon: Sparkles },
  { href: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { href: "/custos-fixos", label: "Fixos", icon: Repeat },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/orcamento", label: "Orçamento", icon: PiggyBank },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    badge: "review",
    matches: SETTINGS_PATHS,
  },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isItemActive(pathname: string, item: NavItem): boolean {
  return [item.href, ...(item.matches ?? [])].some((href) => isActive(pathname, href));
}
