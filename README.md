# Barbearia Reserva

Site público, agendamento sem cadastro e painel administrativo para uma única barbearia. O projeto usa Next.js/React no front-end e Supabase (PostgreSQL + Auth + RLS) no backend.

## Arquitetura

- **Front-end:** Next.js 16, React 19, TypeScript e CSS mobile-first.
- **Banco e API:** Supabase/PostgreSQL. O navegador usa somente a publishable key.
- **Autenticação:** Supabase Auth por e-mail e senha, sem tela pública de cadastro.
- **Autorização:** allowlist `admin_users`; estar autenticado não concede acesso administrativo.
- **Deploy:** GitHub Pages via Actions ou hosting compatível com HTTPS.
- **Isolamento:** uma barbearia = um repositório + um projeto Supabase. Não reutilize o projeto de banco entre clientes.

GitHub Pages é adequado porque a aplicação é estática e todo estado confiável fica no Supabase. O banco revalida as regras; a segurança não depende do JavaScript ou de uma URL secreta.

## O que está implementado

- site público premium e responsivo;
- fluxo Serviço → Profissional → Data → Horário → Dados → Confirmação;
- disponibilidade por expediente, intervalos, duração, bloqueios e reservas existentes;
- exclusion constraint contra sobreposição e confirmação transacional com advisory lock;
- idempotência, honeypot, limites de campos, sanitização, limite de reservas e mensagens seguras;
- RLS em todas as tabelas, privilégios mínimos e RPCs validadas;
- login/logout e autorização administrativa separada;
- agenda diária, navegação por data, próximos atendimentos, bloqueios, cancelamento e status;
- política de retenção: anonimização após 180 dias e exclusão após 730 dias;
- configuração centralizada em `lib/config.ts`;
- workflow de deploy e validação em `.github/workflows/deploy-pages.yml`.

## Configuração inicial do Supabase

1. Crie um projeto Supabase exclusivo para a barbearia.
2. No **SQL Editor**, execute `supabase/migrations/20260813220000_initial_booking_system.sql`.
3. Em **Authentication → Providers → Email**, mantenha login por e-mail/senha habilitado. Não exponha cadastro público.
4. Copie somente a **Project URL** e a **Publishable key** para as variáveis públicas. Nunca use `service_role`, secret key, senha do banco ou JWT secret no navegador.

### Criar o primeiro administrador

Esta é deliberadamente a única etapa que não é automatizada pelo código:

1. Entre em **Supabase Dashboard → Authentication → Users → Add user**.
2. Informe um e-mail individual e uma senha aleatória forte. Marque o usuário como confirmado se o Dashboard oferecer essa opção.
3. Não use nome da barbearia, telefone, CNPJ, nome do proprietário, `admin/admin`, `123456` ou qualquer padrão previsível.
4. Não envie a senha por chat, e-mail ou commit. Guarde-a em um gerenciador de senhas.
5. Copie o UUID do usuário criado.
6. Vá em **Table Editor → admin_users → Insert row** e preencha apenas:
   - `user_id`: UUID copiado;
   - `is_active`: `true`.

O e-mail administrativo não fica no código nem em tabelas públicas. Para revogar acesso, altere `is_active` para `false` ou remova a linha de `admin_users`.

## Configuração local

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Preencha em `.env.local` somente:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env.local` é ignorado pelo Git. A publishable key pode estar no front-end; ela é de baixo privilégio e depende de RLS. Nenhuma chave elevada pode entrar no repositório.

## Publicação no GitHub Pages

1. Crie o repositório e envie o código para a branch `main`.
2. No GitHub, abra **Settings → Secrets and variables → Actions → Variables**.
3. Crie duas **Variables** (não Secrets, pois são públicas):
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Abra **Settings → Pages → Build and deployment** e selecione **GitHub Actions**.
5. Execute o workflow **Validate and deploy GitHub Pages** ou faça push na `main`.
6. Em **Supabase → Authentication → URL Configuration**, configure a URL publicada como **Site URL** e adicione-a aos redirect URLs permitidos.

O workflow falha se a configuração do Supabase não estiver definida, evitando que uma réplica seja publicada usando por engano o banco de outra barbearia.

## Como criar uma nova barbearia a partir deste projeto

1. Duplique o repositório.
2. Crie um novo projeto Supabase Free — nunca reaproveite o projeto de outro cliente.
3. Execute a migration SQL no projeto novo.
4. Troque nome, marca, cores, WhatsApp, Instagram, endereço, fuso e textos em `lib/config.ts`.
5. Troque serviços, profissionais e expediente no bloco final da migration antes de executá-la.
6. Configure as duas Variables públicas do novo repositório.
7. Crie cada administrador exclusivamente no Supabase Auth e adicione seu UUID à allowlist.
8. Rode os testes e publique.

## Retenção e LGPD

São coletados apenas nome, WhatsApp e dados do atendimento. A função `run_data_retention()`:

- anonimiza nome e telefone 180 dias após atendimentos finalizados/cancelados/no-show;
- exclui registros com mais de 730 dias;
- limpa fingerprints técnicos de abuso com mais de 24 horas.

Ela já fica agendada pelo Supabase Cron para o primeiro dia de cada mês, às 03:15 UTC. Também pode ser executada manualmente no SQL Editor. A função só aceita contexto privilegiado, nunca o navegador.

## Testes e qualidade

```bash
npm run lint
npm test
```

O relatório dos testes executados está em `docs/TEST_REPORT.md`. Testes de integração devem usar dados fictícios e remover apenas os registros de teste ao terminar.

## Decisões de segurança

- `appointments`, `blocked_times`, `admin_users` e `abuse_windows` não têm superfície pública direta.
- O público vê somente catálogo e `Disponível/Indisponível` por RPC.
- `create_appointment` é pública intencionalmente, mas valida novamente serviço, profissional, data, expediente, bloqueios, sobreposição, honeypot, consentimento e idempotência.
- Funções administrativas exigem sessão Supabase válida **e** `is_admin() = true`.
- A exclusion constraint GiST impede conflitos mesmo sob concorrência real.
- Erros do banco são traduzidos em mensagens sem detalhes técnicos no front-end.

## Estrutura principal

```text
app/                 site e /admin
lib/config.ts        configuração central da barbearia
lib/supabase.ts      cliente público Supabase
supabase/migrations/ schema, RLS, RPCs, índices e dados iniciais
.github/workflows/   CI e deploy GitHub Pages
docs/                relatório de segurança e testes
```
