-- Limpeza dos dados de teste de UM usuário. NÃO é uma migração: rode à mão no SQL Editor.
-- Não tem volta. Rode a PARTE 1, confira os números e só então rode a PARTE 2.
--
-- O app tem vários usuários: troque 'SEU-EMAIL@exemplo.com' pelo e-mail da conta
-- a limpar, nas DUAS partes. Os dados dos outros usuários não são tocados.
--
-- Mantém: categorias, regras automáticas de categoria, orçamentos e as conexões
-- do Open Finance com o banco escolhido para cada uma (tabela bank_items).
--
-- Apaga: lançamentos, importações de planilha, faturas, cartões, contas,
-- custos fixos, metas e a área de revisão do banco. Custos fixos e metas
-- precisam sair porque dependem das contas.
--
-- Depois da limpeza, em Open Finance, clique em "Importar contas": as contas e
-- cartões conectados voltam com o saldo atual informado pelo banco.


-- ===== PARTE 1: o que será apagado (rode sozinha) =====

with alvo as (select id from auth.users where email = 'SEU-EMAIL@exemplo.com')
select 'usuário encontrado' as item, count(*) from alvo
union all select 'lançamentos', count(*) from public.transactions where user_id in (select id from alvo)
union all select 'importações de planilha', count(*) from public.imports where user_id in (select id from alvo)
union all select 'faturas', count(*) from public.invoices where user_id in (select id from alvo)
union all select 'cartões', count(*) from public.credit_cards where user_id in (select id from alvo)
union all select 'contas', count(*) from public.accounts where user_id in (select id from alvo)
union all select 'custos fixos', count(*) from public.recurring_rules where user_id in (select id from alvo)
union all select 'metas', count(*) from public.goals where user_id in (select id from alvo)
union all select 'transações do banco em revisão', count(*) from public.bank_transactions where user_id in (select id from alvo)
union all select 'vínculos com contas do banco', count(*) from public.bank_links where user_id in (select id from alvo)
union all select 'histórico de patrimônio', count(*) from public.net_worth_snapshots where user_id in (select id from alvo);


-- ===== PARTE 2: apagar (selecione deste ponto até o fim e rode) =====

begin;

create temp table alvo on commit drop as
  select id from auth.users where email = 'SEU-EMAIL@exemplo.com';

-- Para tudo se o e-mail não existir, em vez de não apagar nada sem avisar.
do $$
begin
  if (select count(*) from alvo) <> 1 then
    raise exception 'E-mail não encontrado. Troque SEU-EMAIL@exemplo.com pelo e-mail da conta.';
  end if;
end;
$$;

-- Ordem importa: primeiro o que aponta para outras tabelas.
delete from public.bank_transactions where user_id in (select id from alvo);
delete from public.transactions where user_id in (select id from alvo);
delete from public.imports where user_id in (select id from alvo);
delete from public.invoices where user_id in (select id from alvo);
delete from public.recurring_rules where user_id in (select id from alvo);
delete from public.goals where user_id in (select id from alvo);
delete from public.bank_links where user_id in (select id from alvo);
delete from public.credit_cards where user_id in (select id from alvo);
delete from public.accounts where user_id in (select id from alvo);
delete from public.net_worth_snapshots where user_id in (select id from alvo);

commit;
