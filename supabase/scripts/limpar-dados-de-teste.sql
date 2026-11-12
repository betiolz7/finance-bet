-- Limpeza dos dados de teste. NÃO é uma migração: rode à mão no SQL Editor.
-- Não tem volta. Rode a PARTE 1, confira os números e só então rode a PARTE 2.
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

select 'lançamentos' as item, count(*) from public.transactions
union all select 'importações de planilha', count(*) from public.imports
union all select 'faturas', count(*) from public.invoices
union all select 'cartões', count(*) from public.credit_cards
union all select 'contas', count(*) from public.accounts
union all select 'custos fixos', count(*) from public.recurring_rules
union all select 'metas', count(*) from public.goals
union all select 'transações do banco em revisão', count(*) from public.bank_transactions
union all select 'vínculos com contas do banco', count(*) from public.bank_links
union all select 'histórico de patrimônio', count(*) from public.net_worth_snapshots;


-- ===== PARTE 2: apagar (selecione deste ponto até o fim e rode) =====

begin;

-- Ordem importa: primeiro o que aponta para outras tabelas.
delete from public.bank_transactions;
delete from public.transactions;
delete from public.imports;
delete from public.invoices;
delete from public.recurring_rules;
delete from public.goals;
delete from public.bank_links;
delete from public.credit_cards;
delete from public.accounts;
delete from public.net_worth_snapshots;

commit;
