"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AssistantAnswer } from "@/lib/assistant/answer";
import { formatCents } from "@/lib/money";
import { ask } from "./actions";

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; answer: AssistantAnswer };

const TONE: Record<string, string> = {
  income: "text-income",
  expense: "text-ink",
  warning: "text-expense",
  neutral: "text-ink",
};

export function Chat({ suggestions }: { suggestions: string[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setInput("");
    setMessages((current) => [...current, { id: nextId.current++, role: "user", text }]);
    startTransition(async () => {
      const answer = await ask(text);
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", answer },
      ]);
    });
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-[20px] bg-surface p-6 text-center">
            <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-brand-soft text-income">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <p className="font-medium">Pergunte sobre o seu dinheiro</p>
            <p className="mt-1 text-sm text-muted">
              As respostas são calculadas com os seus lançamentos, sem enviar nada
              para fora do app.
            </p>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-on-ink">
                {message.text}
              </p>
            </div>
          ) : (
            <AnswerCard key={message.id} answer={message.answer} onSuggest={send} />
          ),
        )}

        {pending && (
          <p className="text-sm text-muted" role="status">
            Calculando...
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-28 mt-6 md:bottom-4">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              disabled={pending}
              className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm whitespace-nowrap hover:bg-soft disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-sm ring-1 ring-line"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ex.: quanto gastei com iFood em outubro?"
            aria-label="Sua pergunta"
            maxLength={300}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            aria-label="Enviar pergunta"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-on-ink disabled:opacity-40"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

function AnswerCard({
  answer,
  onSuggest,
}: {
  answer: AssistantAnswer;
  onSuggest: (question: string) => void;
}) {
  return (
    <div className="max-w-[min(100%,40rem)] rounded-2xl rounded-bl-md bg-surface p-4">
      <p className="text-xs font-medium text-muted">{answer.title}</p>
      <p className="mt-1 text-sm">{answer.summary}</p>

      {answer.rows.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {answer.rows.map((row, index) => (
            <li key={index} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{row.label}</p>
                {row.detail && <p className="text-xs text-muted">{row.detail}</p>}
              </div>
              <p
                className={`shrink-0 text-sm font-medium tabular-nums ${TONE[row.tone ?? "neutral"]}`}
              >
                {row.cents !== undefined ? formatCents(row.cents) : row.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      {answer.suggestions && (
        <div className="mt-3 flex flex-wrap gap-2">
          {answer.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggest(suggestion)}
              className="rounded-full border border-line px-3 py-1 text-xs hover:bg-soft"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {answer.link && (
        <Link
          href={answer.link.href}
          className="mt-3 inline-block text-sm font-medium text-income underline-offset-2 hover:underline"
        >
          {answer.link.label} →
        </Link>
      )}
    </div>
  );
}
