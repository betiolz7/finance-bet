import { redirect } from "next/navigation";

/** Configurações abre na primeira aba. */
export default function SettingsPage() {
  redirect("/contas");
}
