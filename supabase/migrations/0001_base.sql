-- Etapa 1: contas, categorias e lançamentos.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('checking', 'savings', 'cash', 'investment')),
  initial_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#9bcf53',
  created_at timestamptz not null default now()
);

create unique index categories_unique_name
  on public.categories (user_id, kind, lower(name));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  status text not null default 'paid' check (status in ('pending', 'paid')),
  amount_cents bigint not null check (amount_cents > 0),
  date date not null,
  description text not null check (length(trim(description)) > 0),
  account_id uuid not null references public.accounts (id) on delete restrict,
  to_account_id uuid references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint transactions_shape check (
    (type = 'transfer'
      and to_account_id is not null
      and to_account_id <> account_id
      and category_id is null)
    or
    (type in ('income', 'expense')
      and to_account_id is null
      and category_id is not null)
  )
);

create index transactions_user_date on public.transactions (user_id, date desc);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy accounts_owner on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy categories_owner on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy transactions_owner on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- security_invoker faz a view respeitar as políticas de quem consulta.
create view public.account_balances with (security_invoker = true) as
select
  a.id,
  a.name,
  a.kind,
  a.archived,
  a.initial_balance_cents,
  a.initial_balance_cents + coalesce(sum(m.delta), 0)::bigint as balance_cents
from public.accounts a
left join (
  select
    account_id,
    case when type = 'income' then amount_cents else -amount_cents end as delta
  from public.transactions
  where status = 'paid'
  union all
  select to_account_id, amount_cents
  from public.transactions
  where status = 'paid' and type = 'transfer'
) m on m.account_id = a.id
group by a.id;

grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select on public.account_balances to authenticated;
