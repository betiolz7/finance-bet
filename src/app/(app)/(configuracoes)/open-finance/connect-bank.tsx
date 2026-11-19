"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { primaryButtonClass } from "@/components/ui";
import { saveBankItem } from "./actions";

// O widget depende do navegador e não pode ser renderizado no servidor.
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((module) => module.PluggyConnect),
  { ssr: false },
);

export function ConnectBank() {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function open() {
    setError(undefined);
    startTransition(async () => {
      const response = await fetch("/api/connect-token", { method: "POST" }).catch(
        () => null,
      );
      if (!response?.ok) {
        setError("Não foi possível abrir a conexão. Confira as credenciais da Pluggy.");
        return;
      }
      const { accessToken } = (await response.json()) as { accessToken: string };
      setConnectToken(accessToken);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={pending || connectToken !== null}
        className={primaryButtonClass}
      >
        {pending ? "Abrindo..." : "Conectar banco"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-expense">
          {error}
        </p>
      )}
      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={false}
          onSuccess={async ({ item }) => {
            const result = await saveBankItem(item.id);
            if (result.error) setError(result.error);
          }}
          onError={() => setError("A conexão com o banco não foi concluída.")}
          onLoadError={() => {
            setConnectToken(null);
            setError("Não foi possível carregar a conexão. Tente novamente.");
          }}
          onClose={() => setConnectToken(null)}
        />
      )}
    </>
  );
}
