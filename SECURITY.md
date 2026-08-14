# Segurança

Não abra issue pública contendo dados pessoais, tokens ou credenciais. Revogue imediatamente qualquer chave elevada que tenha sido exposta e substitua-a no backend seguro.

## Nunca commitar

- service account, private key ou token privilegiado;
- senha administrativa;
- `.env.local` ou exportações de usuários/agendamentos.

O navegador recebe somente a configuração pública do Firebase Web SDK. A autorização administrativa depende do Firebase Authentication e da coleção privada `admins` protegida por Security Rules.

## Proteção contra abuso de agendamentos

O projeto inclui:

- validação estrita de celular brasileiro no cliente e nas Security Rules;
- honeypot contra bots simples;
- limitação local de tentativas em rajada e de reservas por navegador;
- suporte a Firebase App Check com reCAPTCHA;
- contador privado `publicBookingCounters`, com limite de até 2 reservas públicas por telefone para a mesma data;
- testes automáticos de segurança antes do deploy do GitHub Pages.

### Ativar o limite server-side sem indisponibilidade

1. Publique `firestore.rules` no projeto Firebase.
2. Configure App Check para o domínio do GitHub Pages e informe `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` nas Variables do ambiente `github-pages`.
3. Defina a variável GitHub `NEXT_PUBLIC_FIREBASE_ABUSE_GUARD_ENABLED=true` e aguarde o deploy concluir.
4. No documento Firestore `settings/general`, adicione `abuseGuardRequired: true`.
5. No Firebase App Check, após validar as métricas, habilite enforcement para Cloud Firestore.

Não habilite `abuseGuardRequired` antes do cliente protegido estar publicado, pois reservas públicas antigas não enviam o contador obrigatório.

## Limites conhecidos

Security Rules do Firestore não recebem o endereço IP do visitante. Bloqueio real por IP exige um backend/proxy intermediário. O projeto usa App Check e limites por telefone/navegador para manter a arquitetura estática simples e econômica.

A validação de formato consegue rejeitar números brasileiros claramente inválidos, mas somente confirmação por SMS/OTP comprova posse real do telefone. Phone Auth gera cobrança por SMS fora da franquia gratuita aplicável e não é ativado por padrão neste projeto.
