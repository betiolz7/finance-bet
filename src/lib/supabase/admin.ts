import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

/**
 * Cliente com a chave "secret" do Supabase: ignora as regras de acesso por usuário.
 * Só para o servidor, em rotas sem sessão (cadastro, webhook, agendador).
 * Toda consulta feita com ele precisa filtrar o usuário à mão.
 */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || !supabaseUrl) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** E-mail do dono do app: o mesmo que recebe os avisos (NOTIFY_EMAIL_TO). */
export function ownerEmail(): string {
  return (process.env.NOTIFY_EMAIL_TO ?? "").trim().toLowerCase();
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = ownerEmail();
  return Boolean(owner && email && email.trim().toLowerCase() === owner);
}

/** Procura o id do usuário pelo e-mail. Serve para poucos usuários (testadores). */
export async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
  return null;
}
