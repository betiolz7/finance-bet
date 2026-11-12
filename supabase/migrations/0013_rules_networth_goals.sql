-- Regras automáticas de categoria, histórico do patrimônio e metas ligadas a
-- investimentos.

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern text not null check (length(trim(pattern)) >= 2),
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index category_rules_unique_pattern
  on public.category_rules (user_id, lower(pattern));

-- Uma linha por mês: o patrimônio do mês é atualizado enquanto o mês corre.
create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  accounts_cents bigint not null,
  investments_cents bigint not null,
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.category_rules enable row level security;
alter table public.net_worth_snapshots enable row level security;

create policy category_rules_owner on public.category_rules
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy net_worth_snapshots_owner on public.net_worth_snapshots
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.category_rules to authenticated;
grant select, insert, update, delete on public.net_worth_snapshots to authenticated;

-- Meta pode acompanhar uma conta ou um investimento da Pluggy.
alter table public.goals
  alter column account_id drop not null,
  add column investment_id text,
  add column investment_name text,
  add constraint goals_source check (num_nonnulls(account_id, investment_id) = 1);
