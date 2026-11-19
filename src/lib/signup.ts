import { timingSafeEqual } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 8;

export interface SignupFields {
  email: string;
  password: string;
  confirm: string;
  invite: string;
}

export type ParsedSignup =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

/** Compara o convite sem revelar, pelo tempo de resposta, onde ele difere. */
function sameSecret(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Valida o cadastro. Sem convite configurado no servidor, ninguém se cadastra.
 */
export function parseSignupInput(
  fields: SignupFields,
  expectedInvite: string | undefined,
): ParsedSignup {
  const fail = (error: string): ParsedSignup => ({ ok: false, error });

  const invite = fields.invite.trim();
  if (!expectedInvite) return fail("O cadastro está fechado no momento.");
  if (!invite || !sameSecret(invite, expectedInvite)) {
    return fail("Código de convite inválido.");
  }

  const email = fields.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Informe um e-mail válido.");

  if (fields.password.length < MIN_PASSWORD_LENGTH) {
    return fail(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (fields.password !== fields.confirm) return fail("As senhas não são iguais.");

  return { ok: true, email, password: fields.password };
}
