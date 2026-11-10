export interface ActionState {
  error?: string;
}

export function describeDbError(error: { code?: string }): string {
  if (error.code === "23505") return "Já existe um registro com esse nome.";
  if (error.code === "23503") {
    return "Este registro está em uso por lançamentos ou custos fixos e não pode ser apagado.";
  }
  return "Não foi possível salvar. Tente novamente.";
}
