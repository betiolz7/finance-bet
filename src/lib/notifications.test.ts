import { describe, expect, it } from "vitest";
import {
  buildCreditEmail,
  creditsFrom,
  isValidWebhookSecret,
  webhookUrl,
} from "./notifications";
import { formatCents } from "./money";
import type { PluggyTransaction } from "./pluggy";

const tx = (change: Partial<PluggyTransaction>): PluggyTransaction => ({
  id: "1",
  description: "Pix recebido",
  amount: 150.5,
  date: "2026-11-11T10:00:00.000Z",
  type: "CREDIT",
  createdAt: "2026-11-12T08:00:00.000Z",
  ...change,
});

describe("isValidWebhookSecret", () => {
  it("aceita só a senha exata", () => {
    expect(isValidWebhookSecret("segredo-longo", "segredo-longo")).toBe(true);
    expect(isValidWebhookSecret("segredo-longX", "segredo-longo")).toBe(false);
    expect(isValidWebhookSecret("curto", "segredo-longo")).toBe(false);
  });

  it("recusa quando falta a senha de um dos lados", () => {
    expect(isValidWebhookSecret(null, "segredo")).toBe(false);
    expect(isValidWebhookSecret("segredo", "")).toBe(false);
  });
});

describe("creditsFrom", () => {
  it("pega só entradas, em centavos positivos", () => {
    expect(
      creditsFrom([
        tx({}),
        tx({ id: "2", type: "DEBIT", amount: -30 }),
        tx({ id: "3", amount: 0 }),
      ]),
    ).toEqual([{ description: "Pix recebido", date: "2026-11-11", cents: 15050 }]);
  });

  it("ignora o que chegou antes do aviso", () => {
    const credits = creditsFrom(
      [tx({}), tx({ id: "2", createdAt: "2026-11-01T00:00:00.000Z" })],
      "2026-11-12T00:00:00.000Z",
    );
    expect(credits).toHaveLength(1);
  });
});

describe("buildCreditEmail", () => {
  it("resume uma entrada no assunto", () => {
    const email = buildCreditEmail(
      "Conta Inter",
      [{ description: "Pix", date: "2026-11-11", cents: 15050 }],
      "https://app.exemplo.com",
    );
    expect(email.subject).toBe(`Entrada de ${formatCents(15050)} em Conta Inter`);
    expect(email.text).toContain("https://app.exemplo.com/open-finance/revisar");
  });

  it("soma várias entradas", () => {
    const email = buildCreditEmail(
      "Conta",
      [
        { description: "A", date: "2026-11-11", cents: 100 },
        { description: "B", date: "2026-11-11", cents: 200 },
      ],
      "",
    );
    expect(email.subject).toBe(`2 entradas somando ${formatCents(300)} em Conta`);
  });

  it("não deixa a descrição do banco virar HTML", () => {
    const email = buildCreditEmail(
      "Conta",
      [{ description: '<img src=x onerror="alert(1)">', date: "2026-11-11", cents: 100 }],
      "",
    );
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });
});

describe("webhookUrl", () => {
  it("exige endereço público com https", () => {
    expect(webhookUrl("https://app.exemplo.com")).toBe(
      "https://app.exemplo.com/api/pluggy/webhook",
    );
    expect(webhookUrl("http://localhost:3000")).toBeNull();
    expect(webhookUrl("")).toBeNull();
  });
});
