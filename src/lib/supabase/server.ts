import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components não gravam cookies. O proxy renova a sessão.
        }
      },
    },
  });
}

/**
 * Único caminho para acessar os dados: confirma a sessão e devolve o cliente.
 * Páginas e Server Actions devem chamar esta função, e não apenas o proxy.
 */
export const requireDb = cache(async () => {
  // Garante renderização por requisição, o que libera o uso da data atual.
  await connection();
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return supabase;
});
