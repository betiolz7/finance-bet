-- Etapa 4: cartões, faturas, parcelas e pagamento de fatura.

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  limit_cents bigint not null default 0 check (limit_cents >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  payment_account_id uuid not null references public.accounts (id) on delete restrict,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- reference_month é o mês do vencimento. As datas ficam gravadas para que mudar
-- o dia de fechamento do cartão não altere faturas já criadas.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.credit_cards (id) on delete restrict,
  reference_month date not null check (extract(day from reference_month) = 1),
  closing_date date not null,
  due_date date not null,
  paid_at date,
  created_at timestamptz not null default now(),
  unique (card_id, reference_month)
);

alter table public.credit_cards enable row level security;
alter table public.invoices enable row level security;

create policy credit_cards_owner on public.credit_cards
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy invoices_owner on public.invoices
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.credit_cards to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;

alter table public.transactions
  alter column account_id drop not null,
  drop constraint transactions_type_check,
  drop constraint transactions_shape,
  add column invoice_id uuid references public.invoices (id) on delete restrict,
  add column installment_group_id uuid,
  add column installment_number smallint check (installment_number >= 1),
  add column installment_total smallint check (installment_total >= 1);

create index transactions_invoice on public.transactions (invoice_id)
  where invoice_id is not null;

alter table public.transactions
  add constraint transactions_type_check
    check (type in ('income', 'expense', 'transfer', 'invoice_payment')),
  add constraint transactions_shape check (
    (type = 'transfer'
      and account_id is not null
      and to_account_id is not null
      and to_account_id <> account_id
      and category_id is null
      and invoice_id is null)
    or
    (type = 'income'
      and account_id is not null
      and to_account_id is null
      and category_id is not null
      and invoice_id is null)
    or
    (type = 'expense'
      and to_account_id is null
      and category_id is not null
      and num_nonnulls(account_id, invoice_id) = 1)
    or
    (type = 'invoice_payment'
      and account_id is not null
      and invoice_id is not null
      and to_account_id is null
      and category_id is null)
  );

alter table public.imports
  alter column account_id drop not null,
  add column card_id uuid references public.credit_cards (id) on delete restrict,
  add constraint imports_destination check (num_nonnulls(account_id, card_id) = 1);

create view public.invoice_totals with (security_invoker = true) as
select
  i.id,
  i.card_id,
  i.reference_month,
  i.closing_date,
  i.due_date,
  i.paid_at,
  coalesce(sum(t.amount_cents) filter (where t.type = 'expense'), 0)::bigint as total_cents
from public.invoices i
left join public.transactions t on t.invoice_id = i.id
group by i.id;

grant select on public.invoice_totals to authenticated;

create function public.day_in_month(p_month date, p_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_month + least(
    p_day,
    extract(day from (p_month + interval '1 month - 1 day'))::integer
  ) - 1
$$;

-- Se o vencimento vem antes do fechamento no calendário, a fatura fecha no mês
-- anterior ao do vencimento.
create function public.invoice_closing_date(p_month date, p_closing_day integer, p_due_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select public.day_in_month(
    case when p_due_day > p_closing_day
      then p_month
      else (p_month - interval '1 month')::date
    end,
    p_closing_day
  )
$$;

create function public.ensure_invoice(p_card_id uuid, p_month date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card public.credit_cards%rowtype;
  v_id uuid;
begin
  select * into v_card from public.credit_cards where id = p_card_id;
  if not found then
    raise exception 'card not found';
  end if;

  insert into public.invoices (card_id, reference_month, closing_date, due_date)
  values (
    p_card_id,
    p_month,
    public.invoice_closing_date(p_month, v_card.closing_day, v_card.due_day),
    public.day_in_month(p_month, v_card.due_day)
  )
  on conflict (card_id, reference_month) do nothing;

  select id into v_id
  from public.invoices
  where card_id = p_card_id and reference_month = p_month;
  return v_id;
end;
$$;

-- Compra feita antes do fechamento entra na fatura; no dia ou depois, na seguinte.
create function public.first_invoice_month(p_card_id uuid, p_date date)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_card public.credit_cards%rowtype;
  v_month date := date_trunc('month', p_date)::date;
  v_closing date;
begin
  select * into v_card from public.credit_cards where id = p_card_id;
  if not found then
    raise exception 'card not found';
  end if;

  loop
    select closing_date into v_closing
    from public.invoices
    where card_id = p_card_id and reference_month = v_month;

    if coalesce(
      v_closing,
      public.invoice_closing_date(v_month, v_card.closing_day, v_card.due_day)
    ) > p_date then
      return v_month;
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;
end;
$$;

-- Fatura já paga não recebe compra nova, pois o valor pago não incluiria a compra.
create function public.open_invoice_month(p_card_id uuid, p_month date)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_month date := p_month;
begin
  while exists (
    select 1 from public.invoices
    where card_id = p_card_id and reference_month = v_month and paid_at is not null
  ) loop
    v_month := (v_month + interval '1 month')::date;
  end loop;
  return v_month;
end;
$$;

create function public.create_card_purchase(
  p_card_id uuid,
  p_date date,
  p_description text,
  p_total_cents bigint,
  p_installments integer,
  p_category_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group uuid := gen_random_uuid();
  v_base bigint;
  v_rest bigint;
  v_month date;
begin
  if p_installments < 1 or p_total_cents < p_installments then
    raise exception 'invalid purchase';
  end if;

  v_base := p_total_cents / p_installments;
  v_rest := p_total_cents % p_installments;
  v_month := public.first_invoice_month(p_card_id, p_date);

  for i in 0 .. p_installments - 1 loop
    v_month := public.open_invoice_month(p_card_id, v_month);

    insert into public.transactions (
      type, status, amount_cents, date, description, category_id,
      invoice_id, installment_group_id, installment_number, installment_total
    )
    values (
      'expense',
      'paid',
      v_base + case when i = 0 then v_rest else 0 end,
      (p_date + make_interval(months => i))::date,
      p_description,
      p_category_id,
      public.ensure_invoice(p_card_id, v_month),
      v_group,
      i + 1,
      p_installments
    );

    v_month := (v_month + interval '1 month')::date;
  end loop;

  return v_group;
end;
$$;

create function public.pay_invoice(
  p_invoice_id uuid,
  p_account_id uuid,
  p_date date,
  p_amount_cents bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card_name text;
begin
  update public.invoices set paid_at = p_date
  where id = p_invoice_id and paid_at is null;
  if not found then
    raise exception 'invoice is not open';
  end if;

  select c.name into v_card_name
  from public.invoices i
  join public.credit_cards c on c.id = i.card_id
  where i.id = p_invoice_id;

  insert into public.transactions (
    type, status, amount_cents, date, description, account_id, invoice_id
  )
  values (
    'invoice_payment', 'paid', p_amount_cents, p_date,
    'Fatura ' || v_card_name, p_account_id, p_invoice_id
  );
end;
$$;

create function public.unpay_invoice(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.transactions
  where invoice_id = p_invoice_id and type = 'invoice_payment';

  update public.invoices set paid_at = null where id = p_invoice_id;
end;
$$;

create function public.move_card_transaction(p_transaction_id uuid, p_months integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_target date;
begin
  select i.* into v_invoice
  from public.transactions t
  join public.invoices i on i.id = t.invoice_id
  where t.id = p_transaction_id and t.type = 'expense';

  if not found or v_invoice.paid_at is not null then
    raise exception 'transaction is not in an open invoice';
  end if;

  v_target := (v_invoice.reference_month + make_interval(months => p_months))::date;

  if public.open_invoice_month(v_invoice.card_id, v_target) <> v_target then
    raise exception 'target invoice is paid';
  end if;

  update public.transactions
  set invoice_id = public.ensure_invoice(v_invoice.card_id, v_target)
  where id = p_transaction_id;
end;
$$;

-- Parcelas de faturas já pagas ficam: esse dinheiro já saiu da conta.
create function public.delete_card_purchase(p_group_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.transactions t
  using public.invoices i
  where t.invoice_id = i.id
    and t.type = 'expense'
    and t.installment_group_id = p_group_id
    and i.paid_at is null
$$;

create function public.import_card_expenses(
  p_file_name text,
  p_date date,
  p_card_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import_id uuid;
  v_invoice_id uuid;
begin
  insert into public.imports (file_name, applied_date, card_id)
  values (p_file_name, p_date, p_card_id)
  returning id into v_import_id;

  v_invoice_id := public.ensure_invoice(
    p_card_id,
    public.open_invoice_month(
      p_card_id,
      public.first_invoice_month(p_card_id, p_date)
    )
  );

  insert into public.transactions (
    type, status, amount_cents, date, description,
    category_id, invoice_id, import_id
  )
  select
    'expense',
    'paid',
    (line ->> 'amount_cents')::bigint,
    p_date,
    line ->> 'name',
    (line ->> 'category_id')::uuid,
    v_invoice_id,
    v_import_id
  from jsonb_array_elements(p_lines) as line;

  return v_import_id;
end;
$$;

grant execute on function public.day_in_month(date, integer) to authenticated;
grant execute on function public.invoice_closing_date(date, integer, integer) to authenticated;
grant execute on function public.ensure_invoice(uuid, date) to authenticated;
grant execute on function public.first_invoice_month(uuid, date) to authenticated;
grant execute on function public.open_invoice_month(uuid, date) to authenticated;
grant execute on function public.create_card_purchase(uuid, date, text, bigint, integer, uuid) to authenticated;
grant execute on function public.pay_invoice(uuid, uuid, date, bigint) to authenticated;
grant execute on function public.unpay_invoice(uuid) to authenticated;
grant execute on function public.move_card_transaction(uuid, integer) to authenticated;
grant execute on function public.delete_card_purchase(uuid) to authenticated;
grant execute on function public.import_card_expenses(text, date, uuid, jsonb) to authenticated;
