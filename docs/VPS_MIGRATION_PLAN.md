# VPS Migration Plan

## Goal

PrzenieĹ›Ä‡ aplikacjÄ™ z modelu:

- frontend + auth + database + storage + edge functions w legacy-backend

na model:

- frontend na VPS
- backend API na VPS
- auth na VPS
- database na VPS
- storage na VPS lub S3-compatible storage

Po zakoĹ„czeniu migracji aplikacja nie powinna juĹĽ wymagaÄ‡ legacy-backend do dziaĹ‚ania produkcyjnego.

## Recommended Target Stack

ZaĹ‚oĹĽenie dla migracji:

- `Node.js` backend
- `PostgreSQL` jako gĹ‚Ăłwna baza
- `JWT + refresh tokens` dla auth
- `Google OAuth` po stronie backendu
- `local disk` albo `S3/R2/MinIO` dla plikĂłw
- `Nginx` jako reverse proxy
- `cron` lub `queue worker` dla zadaĹ„ cyklicznych

## What legacy-backend Does Today

legacy-backend jest obecnie uĹĽywany do:

- auth uĹĽytkownikĂłw
- Google OAuth
- resetu hasĹ‚a
- trzymania sesji po stronie frontendu
- bazy danych
- storage dla grafik i badge'y
- edge functions
- czÄ™Ĺ›ci logiki administracyjnej i billingowej

## Public Tables To Migrate

W kodzie aplikacji wykorzystywane sÄ… co najmniej te tabele publiczne:

- `admin_audit_log`
- `admin_badges`
- `admin_emoji_categories`
- `admin_emojis`
- `admin_panel_role_tabs`
- `admin_panel_roles`
- `admin_panel_user_roles`
- `ai_model_keys`
- `ai_models`
- `badge_package_access`
- `credit_packages`
- `credit_purchases`
- `credit_usage`
- `daily_free_usage`
- `email_templates`
- `favorite_emojis`
- `favorite_tools`
- `graphics`
- `hidden_static_badges`
- `invoice_settings`
- `mailerlite_config`
- `mailerlite_package_groups`
- `profiles`
- `rate_limits`
- `site_content`
- `site_settings`
- `tool_pricing`
- `user_credits`
- `user_roles`

Dodatkowo trzeba zastÄ…piÄ‡ dane z `auth.users` legacy-backend wĹ‚asnÄ… tabelÄ… uĹĽytkownikĂłw i systemem sesji.

## Storage To Migrate

W kodzie uĹĽywane sÄ… co najmniej te buckety storage:

- `graphics`
- `badges`

## Edge Functions To Replace

Do zastÄ…pienia na VPS:

- `admin-coupons`
- `admin-stripe`
- `admin-users`
- `auth-email`
- `create-checkout`
- `daily-credits`
- `edit-image`
- `generate-image`
- `generate-invoice`
- `image-to-prompt`
- `ksef-send-invoice`
- `mailerlite-groups`
- `ocr`
- `send-email`
- `stripe-webhook`
- `verify-payment`
- `verify-turnstile`

## Direct Frontend legacy-backend Usage To Remove

Frontend nie korzysta tylko z edge functions. Ma teĹĽ bezpoĹ›rednie odczyty i zapisy do auth, tabel i storage.

NajwaĹĽniejsze obszary:

- auth:
  - `src/pages/Auth.tsx`
  - `src/pages/ResetPassword.tsx`
  - `src/pages/Profile.tsx`
  - `src/hooks/useAuth.ts`
- gallery / graphics / storage:
  - `src/pages/Gallery.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/pages/RemoveBg.tsx`
  - `src/pages/Filters.tsx`
  - `src/pages/CropTool.tsx`
  - `src/pages/Collage.tsx`
  - `src/pages/TextOverlay.tsx`
  - `src/lib/graphicsLimit.ts`
- admin CRUD:
  - `src/components/AdminBadges.tsx`
  - `src/components/AdminEmails.tsx`
  - `src/components/AdminEmojis.tsx`
  - `src/components/AdminMailerLite.tsx`
  - `src/components/AdminPackages.tsx`
  - `src/components/AdminToolPricing.tsx`
  - `src/components/AdminContent.tsx`

Te miejsca po migracji muszÄ… zostaÄ‡ przepiÄ™te na wĹ‚asne API.

## External Integrations To Preserve

Backend VPS musi obsĹ‚uĹĽyÄ‡:

- `Stripe`
- `Google OAuth`
- `Gemini API`
- `OpenAI API`
- `Resend` albo wĹ‚asny SMTP/webhook
- `MailerLite`
- `KSeF`
- `captcha` (`Cloudflare Turnstile`, `reCAPTCHA`, `hCaptcha`)

## Migration Phases

### Phase 1: Backend foundation

PrzygotowaÄ‡ na VPS:

- projekt backendu
- poĹ‚Ä…czenie z PostgreSQL
- system env
- auth middleware
- logger
- upload/storage adapter

### Phase 2: Replace edge functions

Najpierw przepisaÄ‡ endpointy najbardziej krytyczne dla dziaĹ‚ania:

- `generate-image`
- `edit-image`
- `auth-email`
- `create-checkout`
- `verify-payment`
- `stripe-webhook`
- `admin-users`

### Phase 3: Move direct DB access behind API

Frontend nie moĹĽe juĹĽ czytaÄ‡ i zapisywaÄ‡ tabel bezpoĹ›rednio.

Priorytet:

- auth/session endpoints
- gallery endpoints
- admin settings endpoints
- billing endpoints
- content/badges/emojis endpoints

### Phase 4: Migrate storage

Trzeba przenieĹ›Ä‡:

- istniejÄ…ce grafiki uĹĽytkownikĂłw
- badge assets
- logikÄ™ signed/public URLs
- usuwanie plikĂłw

### Phase 5: Migrate auth

Do wdroĹĽenia na VPS:

- login email/password
- signup email/password
- password reset
- Google OAuth callback
- refresh tokens
- account/profile sync

### Phase 6: Final cutover

Po peĹ‚nym przepiÄ™ciu:

- usunÄ…Ä‡ `VITE_legacy-backend_URL`
- usunÄ…Ä‡ `VITE_legacy-backend_PUBLISHABLE_KEY`
- usunÄ…Ä‡ klienta legacy-backend z frontu
- wyĹ‚Ä…czyÄ‡ zaleĹĽnoĹ›ci od edge functions

## Recommended Execution Order

Najbezpieczniejsza kolejnoĹ›Ä‡:

1. postawiÄ‡ backend VPS
2. przepisaÄ‡ edge functions AI/billing/auth-email
3. dodaÄ‡ nowe REST API dla admina i galerii
4. przepiÄ…Ä‡ frontend moduĹ‚ po module
5. przenieĹ›Ä‡ auth i Google login
6. przenieĹ›Ä‡ storage
7. wyĹ‚Ä…czyÄ‡ legacy-backend

## Minimum Acceptance Criteria For Full VPS Mode

MigracjÄ™ moĹĽna uznaÄ‡ za zakoĹ„czonÄ…, gdy:

- uĹĽytkownik loguje siÄ™ bez legacy-backend Auth
- reset hasĹ‚a dziaĹ‚a bez legacy-backend
- Google OAuth nie uĹĽywa `*.legacy-backend.co`
- frontend nie wywoĹ‚uje `legacy-backend.functions.invoke(...)`
- frontend nie uĹĽywa `legacy-backend.from(...)`
- frontend nie uĹĽywa `legacy-backend.storage`
- frontend nie uĹĽywa `legacy-backend.auth`
- wszystkie grafiki i pliki sÄ… serwowane z VPS lub docelowego storage
- pĹ‚atnoĹ›ci, maile i KSeF dziaĹ‚ajÄ… bez edge functions

