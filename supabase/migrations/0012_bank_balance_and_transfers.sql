-- Saldo das contas conectadas passa a ser o informado pelo banco, e a revisão
-- reconhece transferências entre contas do próprio usuário.

alter table public.accounts
  add column bank_balance_cents bigint,
  add column bank_balance_at timestamptz;

-- balance_cents: saldo do banco quando a conta é conectada; senão, o calculado.
-- ledger_balance_cents: sempre o calculado pelos lançamentos do app.
create or replace view public.account_balances with (security_invoker = true) as
select
  a.id,
  a.name,
  a.kind,
  a.archived,
  a.initial_balance_cents,
  coalesce(a.bank_balance_cents, a.initial_balance_cents + coalesce(sum(m.delta), 0))::bigint
    as balance_cents,
  (a.initial_balance_cents + coalesce(sum(m.delta), 0))::bigint as ledger_balance_cents,
  a.bank_balance_at
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

-- Atualiza o saldo informado pelo banco das contas ligadas à Pluggy.
create function public.set_bank_balances(p_items jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.accounts a
  set bank_balance_cents = (item ->> 'balance_cents')::bigint,
      bank_balance_at = now()
  from jsonb_array_elements(p_items) as item
  join public.bank_links l on l.pluggy_account_id = item ->> 'pluggy_account_id'
  where l.account_id = a.id
$$;

grant execute on function public.set_bank_balances(jsonb) to authenticated;

-- Mesma revisão de antes, mais a ação 'transfer': a saída de uma conta e a
-- entrada em outra conta do usuário viram uma transferência só.
create or replace function public.apply_bank_review(p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_row public.bank_transactions%rowtype;
  v_pair public.bank_transactions%rowtype;
  v_link public.bank_links%rowtype;
  v_to_account uuid;
  v_action text;
  v_transaction_id uuid;
  v_count integer := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_row
    from public.bank_transactions
    where id = (v_item ->> 'id')::uuid and state = 'new'
    for update;

    -- Já decidida (ou consumida como par de transferência): não lança de novo.
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

    if v_action = 'transfer' then
      select * into v_pair
      from public.bank_transactions
      where id = (v_item ->> 'pair_id')::uuid
        and state in ('new', 'ignored')
        and direction = 'credit'
      for update;
      if not found or v_row.direction <> 'debit' then
        raise exception 'transfer pair not found';
      end if;

      select account_id into v_to_account from public.bank_links where id = v_pair.link_id;
      if v_link.account_id is null or v_to_account is null
        or v_to_account = v_link.account_id then
        raise exception 'transfer accounts invalid';
      end if;

      insert into public.transactions (
        type, status, amount_cents, date, description, account_id, to_account_id
      )
      values (
        'transfer', 'paid', v_row.amount_cents, v_row.date, v_row.description,
        v_link.account_id, v_to_account
      )
      returning id into v_transaction_id;

      update public.bank_transactions
      set state = 'imported', transaction_id = v_transaction_id
      where id = v_pair.id;

    elsif v_action = 'match' then
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
