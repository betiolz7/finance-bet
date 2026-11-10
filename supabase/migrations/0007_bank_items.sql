-- Conexões criadas pelo widget da Pluggy dentro do app.

create table public.bank_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.bank_items enable row level security;

create policy bank_items_owner on public.bank_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.bank_items to authenticated;
