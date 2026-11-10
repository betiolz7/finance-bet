-- Etapa 6: metas. O progresso é o saldo da conta vinculada.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  target_cents bigint not null check (target_cents > 0),
  deadline date not null,
  account_id uuid not null references public.accounts (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy goals_owner on public.goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.goals to authenticated;
