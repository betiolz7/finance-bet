-- Visual dos cartões: cor e últimos dígitos, ambos opcionais.
-- Sem cor gravada, o app usa a cor do banco reconhecida pelo nome.

alter table public.credit_cards
  add column color text check (color ~ '^#[0-9a-f]{6}$'),
  add column last_digits text check (last_digits ~ '^[0-9]{4}$');
