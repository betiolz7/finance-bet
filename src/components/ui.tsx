import Link from "next/link";

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-ink disabled:opacity-60";

export const textButtonClass =
  "text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({
  message,
  href,
  linkLabel,
}: {
  message: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="py-10 text-center text-sm text-muted">
      <p>{message}</p>
      {href && (
        <Link href={href} className={`${secondaryButtonClass} mt-3 text-ink`}>
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
