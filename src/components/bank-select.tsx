import { normalizeName } from "@/lib/import";
import { KEEP_INSTITUTION } from "@/lib/institution-server";
import type { PluggyConnector } from "@/lib/pluggy";
import { Field, inputClass } from "./ui";

/** Escolha do banco, para mostrar o ícone certo. Some se a lista não carregar. */
export function BankSelect({
  connectors,
  current,
}: {
  connectors: PluggyConnector[];
  current?: string | null;
}) {
  if (connectors.length === 0) return null;

  const match = current
    ? connectors.find((c) => normalizeName(c.name) === normalizeName(current))
    : undefined;
  const defaultValue = match ? String(match.id) : current ? KEEP_INSTITUTION : "";

  return (
    <Field label="Banco (para o ícone)">
      <select name="connectorId" defaultValue={defaultValue} className={inputClass}>
        <option value="">Sem banco definido</option>
        {current && !match && (
          <option value={KEEP_INSTITUTION}>Manter: {current}</option>
        )}
        {connectors.map((connector) => (
          <option key={connector.id} value={connector.id}>
            {connector.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
