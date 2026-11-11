-- Contas e cartões passam a vir só das conexões do Open Finance.
-- Como uma conexão via MeuPluggy não informa o banco, o usuário escolhe o banco
-- de cada conexão uma vez, e o app guarda nome, ícone e cor fornecidos pela Pluggy.

alter table public.accounts
  add column institution_name text,
  add column institution_logo text,
  add column institution_color text;

alter table public.credit_cards
  add column institution_name text,
  add column institution_logo text,
  add column institution_color text;

alter table public.bank_links add column item_id text;

alter table public.bank_items
  add column connector_id integer,
  add column institution_name text,
  add column institution_logo text,
  add column institution_color text;

-- Cria a conta ou o cartão de uma conta da Pluggy, e o vínculo, juntos.
-- Se o vínculo já existe, só completa o item_id. Devolve 'created', 'existing'
-- ou 'skipped' (cartão sem nenhuma conta para pagar a fatura).
create function public.connect_pluggy_account(
  p_item_id text,
  p_pluggy_account_id text,
  p_type text,
  p_name text,
  p_balance_cents bigint,
  p_limit_cents bigint,
  p_closing_day integer,
  p_due_day integer,
  p_last_digits text,
  p_import_from date
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.bank_items%rowtype;
  v_account_id uuid;
  v_card_id uuid;
  v_payment_id uuid;
begin
  if exists (
    select 1 from public.bank_links where pluggy_account_id = p_pluggy_account_id
  ) then
    update public.bank_links
    set item_id = p_item_id
    where pluggy_account_id = p_pluggy_account_id and item_id is null;
    return 'existing';
  end if;

  insert into public.bank_items (item_id) values (p_item_id)
  on conflict (item_id) do nothing;
  select * into v_item from public.bank_items where item_id = p_item_id;

  if p_type = 'CREDIT' then
    -- A fatura sai de preferência de uma conta do mesmo banco.
    select l.account_id into v_payment_id
    from public.bank_links l
    join public.accounts a on a.id = l.account_id
    where l.item_id = p_item_id and not a.archived
    order by l.created_at
    limit 1;

    if v_payment_id is null then
      select id into v_payment_id
      from public.accounts
      where not archived
      order by created_at
      limit 1;
    end if;

    if v_payment_id is null then
      return 'skipped';
    end if;

    insert into public.credit_cards (
      name, limit_cents, closing_day, due_day, payment_account_id, last_digits,
      institution_name, institution_logo, institution_color
    )
    values (
      p_name, greatest(coalesce(p_limit_cents, 0), 0), p_closing_day, p_due_day,
      v_payment_id, p_last_digits,
      v_item.institution_name, v_item.institution_logo, v_item.institution_color
    )
    returning id into v_card_id;

    insert into public.bank_links (pluggy_account_id, item_id, card_id, import_from)
    values (p_pluggy_account_id, p_item_id, v_card_id, p_import_from);
  else
    insert into public.accounts (
      name, kind, initial_balance_cents,
      institution_name, institution_logo, institution_color
    )
    values (
      p_name, 'checking', coalesce(p_balance_cents, 0),
      v_item.institution_name, v_item.institution_logo, v_item.institution_color
    )
    returning id into v_account_id;

    insert into public.bank_links (pluggy_account_id, item_id, account_id, import_from)
    values (p_pluggy_account_id, p_item_id, v_account_id, p_import_from);
  end if;

  return 'created';
end;
$$;

-- Guarda o banco escolhido para a conexão e aplica às contas e cartões dela.
create function public.set_item_institution(
  p_item_id text,
  p_connector_id integer,
  p_name text,
  p_logo text,
  p_color text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.bank_items (
    item_id, connector_id, institution_name, institution_logo, institution_color
  )
  values (p_item_id, p_connector_id, p_name, p_logo, p_color)
  on conflict (item_id) do update set
    connector_id = excluded.connector_id,
    institution_name = excluded.institution_name,
    institution_logo = excluded.institution_logo,
    institution_color = excluded.institution_color;

  update public.accounts a
  set institution_name = p_name, institution_logo = p_logo, institution_color = p_color
  from public.bank_links l
  where l.account_id = a.id and l.item_id = p_item_id;

  update public.credit_cards c
  set institution_name = p_name, institution_logo = p_logo, institution_color = p_color
  from public.bank_links l
  where l.card_id = c.id and l.item_id = p_item_id;
end;
$$;

grant execute on function public.connect_pluggy_account(text, text, text, text, bigint, bigint, integer, integer, text, date) to authenticated;
grant execute on function public.set_item_institution(text, integer, text, text, text) to authenticated;
