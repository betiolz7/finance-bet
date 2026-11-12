import { normalizeName } from "./import";

export interface CategoryRule {
  pattern: string;
  category_id: string;
}

/**
 * Categoria pela regra "descrição contém". Se várias regras servirem, vence a
 * de texto mais longo, que é a mais específica ("uber eats" antes de "uber").
 */
export function categoryFromRules(
  description: string,
  rules: CategoryRule[],
  allowed?: (categoryId: string) => boolean,
): string | null {
  const text = normalizeName(description);
  let best: { length: number; categoryId: string } | null = null;
  for (const rule of rules) {
    const pattern = normalizeName(rule.pattern);
    if (!pattern || !text.includes(pattern)) continue;
    if (allowed && !allowed(rule.category_id)) continue;
    if (!best || pattern.length > best.length) {
      best = { length: pattern.length, categoryId: rule.category_id };
    }
  }
  return best?.categoryId ?? null;
}

export function parseRuleInput(fields: { pattern: string; categoryId: string }):
  | { ok: true; data: CategoryRule }
  | { ok: false; error: string } {
  const pattern = fields.pattern.trim().replace(/\s+/g, " ");
  if (normalizeName(pattern).length < 2) {
    return { ok: false, error: "Escreva pelo menos 2 letras do texto a procurar." };
  }
  if (pattern.length > 60) return { ok: false, error: "Use até 60 caracteres." };
  if (!fields.categoryId) return { ok: false, error: "Escolha a categoria." };
  return { ok: true, data: { pattern, category_id: fields.categoryId } };
}
