import { PageHeader } from "@/components/ui";
import { SUGGESTIONS } from "@/lib/assistant/parse";
import { requireDb } from "@/lib/supabase/server";
import { Chat } from "./chat";

export default async function AssistantPage() {
  await requireDb();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Assistente" />
      <Chat suggestions={SUGGESTIONS} />
    </div>
  );
}
