"use client";

import { Card, secondaryButtonClass } from "@/components/ui";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Card>
      <p className="text-sm">Algo deu errado ao carregar ou salvar os dados.</p>
      <button type="button" onClick={reset} className={`${secondaryButtonClass} mt-3`}>
        Tentar novamente
      </button>
    </Card>
  );
}
