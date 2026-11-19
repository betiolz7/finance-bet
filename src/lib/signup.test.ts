import { describe, expect, it } from "vitest";
import { parseSignupInput } from "./signup";

describe("parseSignupInput", () => {
  const valid = {
    email: " Ana@Exemplo.com ",
    password: "12345678",
    confirm: "12345678",
    invite: " convite-123 ",
  };

  it("aceita cadastro com convite certo", () => {
    expect(parseSignupInput(valid, "convite-123")).toEqual({
      ok: true,
      email: "ana@exemplo.com",
      password: "12345678",
    });
  });

  it("fecha o cadastro sem convite configurado", () => {
    expect(parseSignupInput(valid, undefined).ok).toBe(false);
    expect(parseSignupInput(valid, "").ok).toBe(false);
  });

  it.each(["", "errado", "convite-1234"])("rejeita o convite %j", (invite) => {
    expect(parseSignupInput({ ...valid, invite }, "convite-123")).toEqual({
      ok: false,
      error: "Código de convite inválido.",
    });
  });

  it("rejeita e-mail inválido, senha curta e senhas diferentes", () => {
    expect(parseSignupInput({ ...valid, email: "sem-arroba" }, "convite-123").ok).toBe(false);
    expect(
      parseSignupInput({ ...valid, password: "1234567", confirm: "1234567" }, "convite-123").ok,
    ).toBe(false);
    expect(parseSignupInput({ ...valid, confirm: "outra" }, "convite-123").ok).toBe(false);
  });
});
