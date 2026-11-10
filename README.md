# finance-bet

Controle financeiro pessoal. A especificação está em [docs/especificacao-mvp.md](docs/especificacao-mvp.md).

## Configuração

1. No Supabase, abra o SQL Editor e execute os arquivos de `supabase/migrations`, em ordem.
2. Em Authentication, crie o seu usuário e desative novos cadastros.
3. Copie `.env.example` para `.env.local` e preencha a URL do projeto e a chave publishable.

## Comandos

- `npm run dev`: inicia o app em http://localhost:3000
- `npm test`: roda os testes
- `npm run lint`: verifica o código
- `npm run build`: gera a versão de produção
