import { Suspense } from "react";
import { loadShellData } from "@/lib/shell";
import { SettingsTabs } from "./settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="mb-2 text-sm font-medium text-muted">Configurações</p>
      <Suspense fallback={<div className="mb-6 h-10 rounded-xl bg-surface" />}>
        <TabsWithCount />
      </Suspense>
      {children}
    </>
  );
}

async function TabsWithCount() {
  const { reviewCount } = await loadShellData();
  return <SettingsTabs reviewCount={reviewCount} />;
}
