# Barbearia Reserva

Site público, agendamento sem cadastro e painel administrativo para uma barbearia. O front-end estático usa Firebase Authentication, Cloud Firestore e Firebase Security Rules e pode ser publicado no GitHub Pages.

## Arquitetura

- `services` e `barbers`: catálogo público sem dados pessoais;
- `slots`: células de 30 minutos públicas, contendo somente estado (`open`, `booked` ou `blocked`);
- `appointments`: dados pessoais, legíveis somente por administradores autorizados;
- `blockedSlots`: detalhes privados dos bloqueios;
- `admins/{uid}`: allowlist administrativa;
- `settings/general`: fuso, horizonte e expediente semanal.

Uma reserva é uma transação que cria o agendamento e altera todas as células necessárias de `open` para `booked`. As regras exigem o vínculo entre os documentos. Assim, duas reservas concorrentes — inclusive de serviços com mais de 30 minutos — não podem ocupar o mesmo período.

## Configuração do Firebase

1. Crie o Cloud Firestore no **modo nativo**, edição **Standard**, região `southamerica-east1` e modo restrito/produção.
2. Em **Authentication → Sign-in method**, habilite somente **E-mail/senha**. Não crie cadastro público.
3. Registre um Web App em **Configurações do projeto → Geral** e copie a configuração pública para `.env.local`.
4. Publique `firestore.rules` e `firestore.indexes.json`:

```bash
npx firebase-tools deploy --only firestore --project SEU_PROJECT_ID
```

### Primeiro administrador

1. Crie o usuário manualmente em **Authentication → Users** e copie o UID.
2. Em **Firestore Database → Dados**, crie `admins/{UID}` com:
   - `active`: boolean `true`;
   - `createdAt`: timestamp atual.
3. Faça login em `/admin` e clique em **Inicializar agenda**. Isso cria o catálogo e 90 dias de células de disponibilidade.

Não envie nem grave a senha. Para revogar o acesso, altere `active` para `false` ou exclua o documento.

## Configuração local

```bash
cp .env.example .env.local
npm ci
npm run dev
```

A configuração do Web SDK é pública. Segurança e autorização dependem de Authentication + Security Rules. Nunca grave service account, private key, token privilegiado ou senha administrativa.

## GitHub Pages

Em **Settings → Secrets and variables → Actions → Variables**, cadastre:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` (opcional)

Em **Settings → Pages**, selecione **GitHub Actions**. O workflow valida e gera a exportação estática.

Adicione o domínio publicado em **Authentication → Settings → Authorized domains**. Para App Check, registre o domínio no reCAPTCHA v3, defina a variável opcional e só então habilite enforcement após validar o site.

## Testes

```bash
npm run lint
npm test
```

Os testes de regras podem ser executados com os emuladores do Firebase. Nenhum teste deve usar dados reais de clientes.

## Replicação

Use um projeto Firebase e um repositório exclusivos por barbearia. Troque marca e contato em `lib/config.ts`, configure as variáveis públicas, crie o administrador por UID, publique as regras e inicialize a agenda pelo painel.
