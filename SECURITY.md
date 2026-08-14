# Segurança

Não abra issue pública contendo dados pessoais, tokens ou credenciais. Revogue imediatamente qualquer chave elevada que tenha sido exposta e substitua-a no backend seguro.

## Nunca commitar

- `service_role`, `sb_secret_*` ou JWT secret;
- senha do banco;
- senha administrativa;
- `.env.local` ou exportações de usuários/agendamentos.

O navegador deve receber somente a URL do projeto e a publishable key. A autorização administrativa depende da sessão Supabase e da allowlist `admin_users`.

