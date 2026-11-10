# finance-bet: especificação do MVP

App web de controle financeiro pessoal, com um único usuário. A imagem em `img/` é apenas referência visual.

## Tecnologia

- Next.js com TypeScript, hospedado na Vercel.
- Postgres e autenticação no Supabase, com uma única conta e novos cadastros desativados.
- Layout responsivo, para lançar gastos pelo navegador do celular.

## Modelo de dados

| Tabela | Campos principais |
|---|---|
| `accounts` | nome, tipo (corrente, poupança, dinheiro, investimento), saldo inicial |
| `categories` | nome, tipo (receita ou despesa), cor |
| `recurring_rules` | descrição, valor, categoria, conta, dia do vencimento, ativa |
| `credit_cards` | nome, limite, dia de fechamento, dia de vencimento, conta de pagamento |
| `invoices` | cartão, mês de referência, fechamento, vencimento, data de pagamento |
| `transactions` | tipo, valor em centavos, data, descrição, categoria, conta ou fatura, status, conta de destino, dados da parcela, regra de origem, lote de origem |
| `imports` | nome do arquivo, data do envio, data aplicada, conta |
| `budgets` | categoria, mês, limite |
| `goals` | nome, valor-alvo, prazo, conta vinculada |

Tipos de transação: `income`, `expense`, `transfer` e `invoice_payment`.
Status de transação: `pending` e `paid`.

## Regras de cálculo

- Valores são guardados em centavos inteiros.
- Saldo da conta: saldo inicial mais as movimentações pagas. Compras no cartão só afetam o saldo quando a fatura é paga.
- Receitas e despesas contam apenas `income` e `expense`. Transferências e pagamento de fatura ficam de fora.
- Investimentos são transferências para uma conta do tipo investimento e não entram como gasto.
- Compra feita antes do fechamento entra na fatura atual. As demais entram na seguinte. A fatura fica salva na transação e pode ser corrigida manualmente.
- Cada parcela é uma transação na sua própria fatura e conta como gasto no mês dela. Os centavos que sobram da divisão vão na primeira parcela.
- O mês de referência da fatura é o mês do vencimento. Compra feita no dia do fechamento já entra na fatura seguinte.
- Fatura já paga não recebe compra nova: a compra vai para a próxima fatura em aberto.
- Compras em fatura já paga só podem ser alteradas depois de desfazer o pagamento.

## Custos fixos

- Cada custo fixo é uma regra em `recurring_rules`.
- A cada mês, o app gera uma transação `pending` por regra ativa, com a data no dia de vencimento.
- A geração não pode duplicar: existe no máximo uma transação por regra em cada mês.
- A geração ocorre até o mês atual e recupera os meses em que o app não foi aberto.
- Um lançamento apagado não é recriado. Meses em que o custo ficou pausado não são gerados.
- O usuário marca como paga e pode ajustar o valor daquele mês sem alterar a regra.
- Se o mês não tiver o dia de vencimento, a data é o último dia do mês.

## Importação de planilha

Serve para lançar, de vez em quando, gastos que não estavam previstos.

Formato: arquivo `.xlsx` ou `.csv` com duas colunas, nome e valor. O cabeçalho é opcional. Em `.xlsx`, é lida a primeira aba.

Fluxo:

1. O usuário anexa o arquivo.
2. Escolhe para o lote inteiro a data e a conta, porque a planilha não traz essas informações. A data padrão é hoje.
3. Revisa uma prévia, na qual nada ainda foi salvo. Em cada linha pode editar o nome, o valor e a categoria, ou excluir a linha.
4. Confirma, e todas as linhas entram como um lote de despesas pagas. O lote pode ser desfeito por inteiro.

Regras:

- Categoria: sugere a última usada para o mesmo nome. Sem histórico, usa `Imprevistos`.
- Valores aceitos: número do Excel, `1234,56`, `1.234,56` e `R$ 1.234,56`. O sinal é ignorado, pois toda linha é despesa.
- Zero, valor vazio ou texto inválido é erro e bloqueia apenas aquela linha.
- Linha com nome `total` ou `subtotal` vem desmarcada na prévia.
- Linha com mesmo nome e mesmo valor de uma despesa já lançada no mesmo mês é sinalizada como possível duplicada. O usuário decide.
- Em CSV, o separador pode ser ponto e vírgula, vírgula ou tabulação.

## Open Finance

Conexão pessoal via MeuPluggy, gratuita e limitada a 5 conexões. A API da Pluggy só é chamada no servidor.

- O widget da Pluggy abre dentro do app, com um Connect Token criado no servidor para o usuário logado.
- Cada conta da Pluggy é ligada a uma conta ou cartão do app, com uma data inicial.
- As transações vão para uma área de revisão. Nada vira lançamento sem confirmação.
- A direção vem do campo `type` da Pluggy, não do sinal do valor.
- Na revisão, cada linha pode ser lançada, ignorada ou dar baixa em um custo pendente.
- Sugestões padrão: dar baixa em custo pendente da mesma conta e mês; ignorar pagamento de fatura, estorno de cartão e possível duplicada.
- Uma linha já decidida não muda em sincronizações futuras.
- O MeuPluggy atualiza a cada 24 horas, sem atualização manual, e a autorização vale um ano.

## Ordem de construção

1. Base: login, contas, categorias e lançamentos, com botão de novo lançamento sempre visível.
2. Custos fixos.
3. Importação de planilha.
4. Cartões: faturas, parcelas futuras e pagamento de fatura.
5. Dashboard e orçamento: filtro único por mês, saldo total, receitas, despesas, sobra, gasto por categoria, contas a vencer e últimas transações.
6. Metas e projeção. O saldo previsto no fim do mês é o saldo atual, mais receitas pendentes, menos despesas pendentes e faturas abertas que vencem até o fim do mês. O progresso de cada meta é o saldo da conta vinculada.

## Fora do MVP

Importação de OFX, múltiplas moedas, múltiplos usuários, app nativo e movimentação real de dinheiro.
