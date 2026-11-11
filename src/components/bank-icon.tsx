import Image from "next/image";
import { cardTextColor } from "@/lib/card-style";
import { safeLogoUrl } from "@/lib/connected-accounts";

export interface Institution {
  institution_name?: string | null;
  institution_logo?: string | null;
  institution_color?: string | null;
}

function initials(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** Ícone do banco fornecido pela Pluggy. Sem ícone, mostra as iniciais. */
export function BankIcon({
  institution,
  fallbackName,
  size = 40,
}: {
  institution?: Institution | null;
  fallbackName: string;
  size?: number;
}) {
  const name = institution?.institution_name || fallbackName;
  const logo = safeLogoUrl(institution?.institution_logo);
  const color = institution?.institution_color ?? null;

  if (logo) {
    return (
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-line"
        style={{ width: size, height: size }}
        title={name}
      >
        <Image
          src={logo}
          alt={name}
          width={size}
          height={size}
          unoptimized
          className="size-full object-contain p-1"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
        color ? "" : "bg-soft text-ink"
      }`}
      style={{
        width: size,
        height: size,
        ...(color ? { background: color, color: cardTextColor(color) } : {}),
      }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
