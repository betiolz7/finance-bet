-- Etapa 2: custos fixos.

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  amount_cents bigint not null check (amount_cents > 0),
  due_day smallint not null check (due_day between 1 and 31),
  category_id uuid not null references public.categories (id) on delete restrict,
  account_id uuid not null references public.accounts (id) on delete restrict,
  active boolean not null default true,
  start_month date not null check (extract(day from start_month) = 1),
  -- Último mês já gerado. Impede recriar um lançamento apagado pelo usuário.
  generated_through date check (extract(day from generated_through) = 1),
  created_at timestamptz not null default now()
);

alter table public.recurring_rules enable row level security;

create policy recurring_rules_owner on public.recurring_rules
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recurring_rules to authenticated;

-- O mês fica em coluna própria para continuar valendo se a data for editada.
alter table public.transactions
  add column recurring_rule_id uuid references public.recurring_rules (id) on delete set null,
  add column recurring_month date;

create unique index transactions_unique_recurring
  on public.transactions (recurring_rule_id, recurring_month)
  where recurring_rule_id is not null;

-- Gera os lançamentos pendentes até p_month, inclusive os meses em que o app
-- não foi aberto. Pode ser chamada várias vezes sem duplicar.
create function public.generate_recurring_transactions(p_month date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  with due as (
    select r.*, m::date as month
    from public.recurring_rules r
    cross join lateral generate_series(
      greatest(
        r.start_month,
        coalesce((r.generated_through + interval '1 month')::date, r.start_month)
      ),
      p_month,
      interval '1 month'
    ) m
    where r.active
  ),
  inserted as (
    insert into public.transactions (
      type, status, amount_cents, date, description,
      account_id, category_id, recurring_rule_id, recurring_month
    )
    select
      'expense',
      'pending',
      amount_cents,
      month + least(
        due_day::integer,
        extract(day from (month + interval '1 month - 1 day'))::integer
      ) - 1,
      description,
      account_id,
      category_id,
      id,
      month
    from due
    on conflict (recurring_rule_id, recurring_month)
      where recurring_rule_id is not null
      do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  update public.recurring_rules
  set generated_through = p_month
  where active
    and start_month <= p_month
    and (generated_through is null or generated_through < p_month);

  return v_count;
end;
$$;

grant execute on function public.generate_recurring_transactions(date) to authenticated;
