import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signIn } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">finance-bet</h1>
        {isSupabaseConfigured ? (
          <ActionForm action={signIn} className="mt-5 space-y-4">
            <Field label="E-mail">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
              />
            </Field>
            <Field label="Senha">
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </Field>
            <SubmitButton className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-on-ink disabled:opacity-60">
              Entrar
            </SubmitButton>
          </ActionForm>
        ) : (
          <p className="mt-4 text-sm text-muted">
            O Supabase ainda não foi configurado. Preencha o arquivo .env.local
            com base em .env.example e reinicie o servidor.
          </p>
        )}
      </Card>
    </main>
  );
}
