"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { primaryButtonClass } from "./ui";

export type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function ActionForm({
  action,
  className,
  children,
}: {
  action: FormAction;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="basis-full text-sm text-expense">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  className = primaryButtonClass,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Salvando..." : children}
    </button>
  );
}

/** Botão de envio que pede confirmação antes de uma ação sem volta. */
export function ConfirmButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
