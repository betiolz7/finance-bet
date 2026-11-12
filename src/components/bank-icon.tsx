import Image from "next/image";
import { brandColor, cardTextColor } from "@/lib/card-style";
import { safeLogoUrl } from "@/lib/connected-accounts";

export interface Institution {
  institution_name?: string | null;
  institution_logo?: string | null;
  institution_color?: string | null;
}

/** "XP", "C6" e "BB" ficam inteiros; nomes longos viram iniciais. */
export function shortLabel(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words[0].length <= 3) return words[0].toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Ícone do banco fornecido pela Pluggy. Sem ícone, mostra o nome curto na cor
 * do banco escolhido ou reconhecido pelo nome.
 */
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
  const color = institution?.institution_color ?? brandColor(name);

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
      className={`flex shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
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
      {shortLabel(name)}
    </span>
  );
}
