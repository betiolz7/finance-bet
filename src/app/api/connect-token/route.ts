import { PluggyClient } from "pluggy-sdk";
import { isPluggyConfigured } from "@/lib/pluggy";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Cria o Connect Token no servidor. As credenciais nunca chegam ao navegador.
export async function POST() {
  if (!isSupabaseConfigured) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isPluggyConfigured()) {
    return Response.json({ error: "pluggy_not_configured" }, { status: 503 });
  }

  try {
    const pluggy = new PluggyClient({
      clientId: process.env.PLUGGY_CLIENT_ID as string,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET as string,
    });
    const { accessToken } = await pluggy.createConnectToken();
    return Response.json({ accessToken });
  } catch {
    return Response.json({ error: "pluggy_error" }, { status: 502 });
  }
}
