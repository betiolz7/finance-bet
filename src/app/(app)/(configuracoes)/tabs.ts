/**
 * Seções de Configurações. As páginas ficam no grupo (configuracoes), que não
 * entra na URL: os endereços continuam /contas, /open-finance etc.
 */
export const SETTINGS_TABS: { href: string; label: string; badge?: "review" }[] = [
  { href: "/contas", label: "Contas" },
  { href: "/open-finance", label: "Open Finance", badge: "review" },
  { href: "/importar", label: "Importar planilha" },
  { href: "/categorias", label: "Categorias" },
];

export const SETTINGS_PATHS = SETTINGS_TABS.map((tab) => tab.href);
