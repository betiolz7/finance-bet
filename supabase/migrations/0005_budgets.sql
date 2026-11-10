-- Etapa 5: orçamento por categoria.

-- Cada linha vale do mês indicado em diante, até existir outra mais recente.
-- limit_cents = 0 significa que a categoria deixou de ter orçamento.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  limit_cents bigint not null check (limit_cents >= 0),
  created_at timestamptz not null default now(),
  unique (category_id, month)
);

alter table public.budgets enable row level security;

create policy budgets_owner on public.budgets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.budgets to authenticated;
