import { resolveCardStyle, type CardFinish } from "@/lib/card-style";

export interface CardVisualData {
  name: string;
  color?: string | null;
  style?: string | null;
  last_digits?: string | null;
}

const FINISH_OVERLAY: Record<CardFinish, string | undefined> = {
  matte: undefined,
  // Reflexo diagonal, como no acabamento de metal.
  metal:
    "linear-gradient(120deg, transparent 25%, rgb(255 255 255 / 0.22) 42%, transparent 58%)",
  // Textura de pontinhos, como no Nubank Prêmiere.
  dots: "radial-gradient(rgb(255 255 255 / 0.14) 0.8px, transparent 1px) 0 0 / 6px 6px",
};

/** Cartão na vertical, como os cartões físicos atuais: só visual, sem valores. */
export function CreditCardVisual({
  card,
  className = "",
}: {
  card: CardVisualData;
  className?: string;
}) {
  const look = resolveCardStyle(card);
  const overlay = FINISH_OVERLAY[look.finish];

  return (
    <div
      role="img"
      aria-label={`Cartão ${card.name}`}
      className={`@container relative aspect-[54/85.6] w-full overflow-hidden rounded-[7%/4.5%] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.45)] ${className}`}
      style={{
        background: look.background,
        color: look.text,
        boxShadow: look.border ? `inset 0 0 0 3px ${look.border}` : undefined,
      }}
    >
      {overlay && (
        <span className="absolute inset-0" style={{ background: overlay }} aria-hidden />
      )}

      <Chip className="absolute top-[11%] right-[12%] w-[22%]" />
      <Contactless
        className="absolute top-[24%] right-[13%] w-[9%]"
        color={look.accent}
      />

      <span className="absolute top-1/2 right-[8%] origin-center translate-x-1/2 -translate-y-1/2 rotate-90 text-[6.5cqw] font-medium tracking-[0.25em] whitespace-nowrap uppercase opacity-85">
        {card.name}
      </span>

      {card.last_digits && (
        <span className="absolute right-[8%] bottom-[5%] font-mono text-[6cqw] tracking-[0.15em] opacity-75">
          •••• {card.last_digits}
        </span>
      )}

      <span
        className="absolute bottom-[6%] left-[9%] max-w-[70%] origin-bottom-left text-[26cqw] leading-[0.8] font-extrabold tracking-[-0.06em] whitespace-nowrap"
        style={{
          color: look.wordmarkColor,
          fontSize: look.wordmark.length > 5 ? "13cqw" : undefined,
        }}
      >
        {look.wordmark}
      </span>
    </div>
  );
}

function Chip({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 40 30" className={className} aria-hidden>
      <defs>
        <linearGradient id="chip-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f4f4" />
          <stop offset="0.5" stopColor="#c9cbcd" />
          <stop offset="1" stopColor="#e8e9ea" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="29" rx="5" fill="url(#chip-metal)" stroke="#9fa2a5" strokeWidth="0.6" />
      <g fill="none" stroke="#9a9da1" strokeWidth="0.8">
        <path d="M0.5 10 H13 M0.5 20 H13 M27 10 H39.5 M27 20 H39.5" />
        <path d="M13 0.5 V30 M27 0.5 V30" />
        <rect x="13" y="8" width="14" height="14" rx="3" />
      </g>
    </svg>
  );
}

function Contactless({ className, color }: { className: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M6 8.5a5 5 0 0 1 0 7" />
        <path d="M10 6a9 9 0 0 1 0 12" />
        <path d="M14 3.5a13 13 0 0 1 0 17" />
      </g>
    </svg>
  );
}
