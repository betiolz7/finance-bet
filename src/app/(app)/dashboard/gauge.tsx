const SEGMENTS = 5;
const GAP_DEGREES = 4;
const RADIUS = 78;
const STROKE = 26;
const CX = 100;
const CY = 100;

function point(degrees: number): string {
  const radians = (degrees * Math.PI) / 180;
  return `${CX - RADIUS * Math.cos(radians)} ${CY - RADIUS * Math.sin(radians)}`;
}

function arc(from: number, to: number): string {
  return `M ${point(from)} A ${RADIUS} ${RADIUS} 0 0 1 ${point(to)}`;
}

/** Meio círculo em cinco segmentos, preenchido até a porcentagem. */
export function Gauge({ percent }: { percent: number }) {
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * 180;
  const span = 180 / SEGMENTS;

  return (
    <svg viewBox="0 0 200 108" className="w-full" aria-hidden>
      {Array.from({ length: SEGMENTS }, (_, index) => {
        const start = index * span + GAP_DEGREES / 2;
        const end = (index + 1) * span - GAP_DEGREES / 2;
        return (
          <g key={index}>
            <path
              d={arc(start, end)}
              fill="none"
              stroke="var(--color-soft)"
              strokeWidth={STROKE}
            />
            {filled > start && (
              <path
                d={arc(start, Math.min(end, filled))}
                fill="none"
                stroke="var(--color-chart)"
                strokeWidth={STROKE}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
