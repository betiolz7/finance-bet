"use server";

import { answerQuestion, type AssistantAnswer } from "@/lib/assistant/answer";
import { todayInBrazil } from "@/lib/dates";
import { requireDb } from "@/lib/supabase/server";

export async function ask(question: string): Promise<AssistantAnswer> {
  const db = await requireDb();
  const text = question.trim().slice(0, 300);
  if (!text) {
    return { title: "Pergunta vazia", summary: "Escreva uma pergunta.", rows: [] };
  }
  try {
    return await answerQuestion(db, text, todayInBrazil());
  } catch {
    return {
      title: "Algo deu errado",
      summary: "Não consegui buscar seus dados agora. Tente novamente.",
      rows: [],
    };
  }
}
