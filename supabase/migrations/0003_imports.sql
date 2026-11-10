-- Etapa 3: importação de planilha.

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text not null,
  applied_date date not null,
  account_id uuid not null references public.accounts (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.imports enable row level security;

create policy imports_owner on public.imports
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.imports to authenticated;

-- Apagar o lote apaga todos os seus lançamentos: é assim que se desfaz.
alter table public.transactions
  add column import_id uuid references public.imports (id) on delete cascade;

create index transactions_import on public.transactions (import_id)
  where import_id is not null;

-- Grava o lote e as linhas juntos: ou entra tudo, ou não entra nada.
create function public.import_expenses(
  p_file_name text,
  p_date date,
  p_account_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import_id uuid;
begin
  insert into public.imports (file_name, applied_date, account_id)
  values (p_file_name, p_date, p_account_id)
  returning id into v_import_id;

  insert into public.transactions (
    type, status, amount_cents, date, description,
    account_id, category_id, import_id
  )
  select
    'expense',
    'paid',
    (line ->> 'amount_cents')::bigint,
    p_date,
    line ->> 'name',
    p_account_id,
    (line ->> 'category_id')::uuid,
    v_import_id
  from jsonb_array_elements(p_lines) as line;

  return v_import_id;
end;
$$;

grant execute on function public.import_expenses(text, date, uuid, jsonb) to authenticated;
