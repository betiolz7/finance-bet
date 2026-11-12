import { normalizeColor, safeLogoUrl } from "./connected-accounts";
import { getConnector, isPluggyConfigured, listBankConnectors, type PluggyConnector } from "./pluggy";

export const KEEP_INSTITUTION = "keep";

export interface InstitutionFields {
  institution_name: string | null;
  institution_logo: string | null;
  institution_color: string | null;
}

/** Lista de bancos da Pluggy para escolher; vazia se a Pluggy não responder. */
export async function loadBankOptions(): Promise<PluggyConnector[]> {
  if (!isPluggyConfigured()) return [];
  try {
    return await listBankConnectors();
  } catch {
    return [];
  }
}

/**
 * Lê o campo "connectorId" do formulário. Sem o campo, ou com "keep", nada muda.
 * Vazio remove o banco. Um número busca nome, ícone e cor na Pluggy.
 */
export async function institutionFromForm(
  formData: FormData,
): Promise<{ fields?: InstitutionFields; error?: string }> {
  const raw = formData.get("connectorId");
  if (raw === null || raw === KEEP_INSTITUTION) return {};
  if (raw === "") {
    return {
      fields: { institution_name: null, institution_logo: null, institution_color: null },
    };
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { error: "Escolha um banco válido." };
  try {
    const connector = await getConnector(id);
    return {
      fields: {
        institution_name: connector.name,
        institution_logo: safeLogoUrl(connector.imageUrl),
        institution_color: normalizeColor(connector.primaryColor),
      },
    };
  } catch {
    return { error: "Não foi possível buscar este banco na Pluggy." };
  }
}
