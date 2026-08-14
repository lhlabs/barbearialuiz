# Segurança

Não abra issue pública contendo dados pessoais, tokens ou credenciais. Revogue imediatamente qualquer chave elevada que tenha sido exposta e substitua-a no backend seguro.

## Nunca commitar

- service account, private key ou token privilegiado;
- senha administrativa;
- `.env.local` ou exportações de usuários/agendamentos.

O navegador recebe somente a configuração pública do Firebase Web SDK. A autorização administrativa depende do Firebase Authentication e da coleção privada `admins` protegida por Security Rules.
