import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass, textButtonClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/signup";
import { signUp } from "./actions";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">
          O finance-bet está em teste. Para entrar, use o código de convite que
          você recebeu.
        </p>
        <ActionForm action={signUp} className="mt-5 space-y-4">
          <Field label="Código de convite">
            <input
              name="invite"
              required
              autoComplete="off"
              autoCapitalize="off"
              className={inputClass}
            />
          </Field>
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </Field>
          <Field label={`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}>
            <input
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          <Field label="Repita a senha">
            <input
              name="confirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          <SubmitButton className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-on-ink disabled:opacity-60">
            Criar conta
          </SubmitButton>
        </ActionForm>
        <p className="mt-4 text-center text-sm text-muted">
          Já tem conta?{" "}
          <Link href="/login" className={textButtonClass}>
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
