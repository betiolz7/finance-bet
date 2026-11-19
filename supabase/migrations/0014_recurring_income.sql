-- Fixos passam a aceitar receitas (salário, aluguel recebido), além de gastos.

alter table public.recurring_rules
  add column type text not null default 'expense'
    check (type in ('income', 'expense'));

-- Mesma geração da 0002, agora usando o tipo de cada fixo.
create or replace function public.generate_recurring_transactions(p_month date)
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
      type,
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
