-- Open Finance via MeuPluggy.

-- Liga uma conta da Pluggy a uma conta ou cartão do app.
create table public.bank_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pluggy_account_id text not null unique,
  account_id uuid references public.accounts (id) on delete cascade,
  card_id uuid references public.credit_cards (id) on delete cascade,
  import_from date not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bank_links_destination check (num_nonnulls(account_id, card_id) = 1)
);

-- Área de revisão: nada vira lançamento antes de o usuário confirmar.
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  link_id uuid not null references public.bank_links (id) on delete cascade,
  pluggy_id text not null unique,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  direction text not null check (direction in ('debit', 'credit')),
  date date not null,
  pluggy_status text,
  category text,
  installment_number smallint,
  installment_total smallint,
  state text not null default 'new' check (state in ('new', 'imported', 'ignored')),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index bank_transactions_state on public.bank_transactions (state, date desc);

alter table public.bank_links enable row level security;
alter table public.bank_transactions enable row level security;

create policy bank_links_owner on public.bank_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy bank_transactions_owner on public.bank_transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.bank_links to authenticated;
grant select, insert, update, delete on public.bank_transactions to authenticated;

-- Atualiza a área de revisão. Linhas já decididas nunca são alteradas. Linhas
-- pendentes que sumiram da Pluggy saem, pois a Pluggy pode trocar o id delas.
create function public.sync_bank_transactions(
  p_link_id uuid,
  p_from date,
  p_rows jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new integer;
begin
  delete from public.bank_transactions b
  where b.link_id = p_link_id
    and b.state = 'new'
    and b.date >= p_from
    and not exists (
      select 1 from jsonb_array_elements(p_rows) r
      where r ->> 'pluggy_id' = b.pluggy_id
    );

  with changed as (
    insert into public.bank_transactions as b (
      link_id, pluggy_id, description, amount_cents, direction, date,
      pluggy_status, category, installment_number, installment_total
    )
    select
      p_link_id, r.pluggy_id, r.description, r.amount_cents, r.direction, r.date,
      r.pluggy_status, r.category, r.installment_number, r.installment_total
    from jsonb_to_recordset(p_rows) as r(
      pluggy_id text,
      description text,
      amount_cents bigint,
      direction text,
      date date,
      pluggy_status text,
      category text,
      installment_number smallint,
      installment_total smallint
    )
    where r.date >= p_from
    on conflict (pluggy_id) do update set
      description = excluded.description,
      amount_cents = excluded.amount_cents,
      direction = excluded.direction,
      date = excluded.date,
      pluggy_status = excluded.pluggy_status,
      category = excluded.category
    where b.state = 'new'
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into v_new from changed;

  update public.bank_links set last_synced_at = now() where id = p_link_id;

  return v_new;
end;
$$;

-- Aplica a revisão inteira de uma vez: ou tudo entra, ou nada entra.
create function public.apply_bank_review(p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_row public.bank_transactions%rowtype;
  v_link public.bank_links%rowtype;
  v_action text;
  v_transaction_id uuid;
  v_count integer := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_row
    from public.bank_transactions
    where id = (v_item ->> 'id')::uuid and state = 'new'
    for update;

    -- Já decidida: envio repetido não pode lançar de novo.
    if not found then
      continue;
    end if;

    select * into v_link from public.bank_links where id = v_row.link_id;
    v_action := v_item ->> 'action';
    v_transaction_id := null;

    if v_action = 'ignore' then
      update public.bank_transactions set state = 'ignored' where id = v_row.id;
      v_count := v_count + 1;
      continue;
    end if;

    if v_action = 'match' then
      update public.transactions
      set status = 'paid', amount_cents = v_row.amount_cents, date = v_row.date
      where id = (v_item ->> 'match_id')::uuid
        and type = 'expense'
        and status = 'pending'
        and account_id = v_link.account_id
      returning id into v_transaction_id;

      if v_transaction_id is null then
        raise exception 'pending transaction not found';
      end if;

    elsif v_action = 'create' and v_link.card_id is not null then
      if v_row.direction <> 'debit' then
        raise exception 'card credit cannot be imported';
      end if;

      insert into public.transactions (
        type, status, amount_cents, date, description, category_id,
        invoice_id, installment_number, installment_total
      )
      values (
        'expense', 'paid', v_row.amount_cents, v_row.date, v_row.description,
        (v_item ->> 'category_id')::uuid,
        public.ensure_invoice(
          v_link.card_id,
          public.open_invoice_month(
            v_link.card_id,
            public.first_invoice_month(v_link.card_id, v_row.date)
          )
        ),
        v_row.installment_number,
        v_row.installment_total
      )
      returning id into v_transaction_id;

    elsif v_action = 'create' then
      insert into public.transactions (
        type, status, amount_cents, date, description, category_id, account_id
      )
      values (
        case when v_row.direction = 'debit' then 'expense' else 'income' end,
        'paid', v_row.amount_cents, v_row.date, v_row.description,
        (v_item ->> 'category_id')::uuid,
        v_link.account_id
      )
      returning id into v_transaction_id;

    else
      raise exception 'unknown action';
    end if;

    update public.bank_transactions
    set state = 'imported', transaction_id = v_transaction_id
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.sync_bank_transactions(uuid, date, jsonb) to authenticated;
grant execute on function public.apply_bank_review(jsonb) to authenticated;
