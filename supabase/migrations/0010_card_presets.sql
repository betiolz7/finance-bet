-- Modelo visual do cartão (por exemplo, nubank-ultravioleta ou inter-black-win).
-- Sem modelo nem cor gravados, o app reconhece o modelo pelo nome do cartão.

alter table public.credit_cards
  add column style text check (style ~ '^[a-z0-9-]+$');
