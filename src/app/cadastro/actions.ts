"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { parseSignupInput } from "@/lib/signup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Cria a conta no servidor, só depois de conferir o convite. O cadastro público
 * do Supabase fica desligado; assim ninguém pula o convite chamando o Supabase direto.
 */
export async function signUp(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const read = (key: string) => String(formData.get(key) ?? "");
  const parsed = parseSignupInput(
    {
      email: read("email"),
      password: read("password"),
      confirm: read("confirm"),
      invite: read("invite"),
    },
    process.env.SIGNUP_INVITE_CODE?.trim(),
  );
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  if (!admin) return { error: "O cadastro não está configurado no servidor." };

  const { error: createError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
  });
  if (createError) {
    return createError.code === "email_exists" || createError.status === 422
      ? { error: "Já existe uma conta com este e-mail. Entre pela tela de login." }
      : { error: "Não foi possível criar a conta. Tente novamente." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });
  if (signInError) return { error: "Conta criada. Entre pela tela de login." };

  // Já com a sessão do usuário novo: as categorias ficam no nome dele.
  await supabase.from("categories").insert(DEFAULT_CATEGORIES);

  redirect("/dashboard");
}
