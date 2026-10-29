# VPS API Map

## Purpose

Ta mapa zamienia obecne edge functions legacy-backend na docelowe endpointy VPS.

## Auth

- `auth-email`
  - current role: welcome email, reset password email
  - target:
    - `POST /auth/email/welcome`
    - `POST /auth/password-reset/request`

- `verify-turnstile`
  - current role: server-side captcha validation
  - target:
    - `POST /security/captcha/verify`

## Users / Admin

- `admin-users`
  - current role: list users, change password, assign roles, reset links, list user graphics, credits actions
  - target:
    - `GET /admin/users`
    - `GET /admin/users/:id/graphics`
    - `POST /admin/users/:id/reset-password`
    - `PATCH /admin/users/:id/password`
    - `PATCH /admin/users/:id/credits`
    - `PATCH /admin/users/:id/admin-role`
    - `PATCH /admin/users/:id/panel-role`
    - `DELETE /admin/users/:id`

- `admin-coupons`
  - target:
    - `GET /admin/coupons`
    - `POST /admin/coupons`
    - `PATCH /admin/coupons/:id`
    - `DELETE /admin/coupons/:id`

- `admin-stripe`
  - target:
    - `GET /admin/stripe/overview`
    - `GET /admin/stripe/account`

- `mailerlite-groups`
  - target:
    - `GET /admin/mailerlite/groups`
    - `POST /admin/mailerlite/config`
    - `POST /marketing/mailerlite/subscribe`

## AI

- `generate-image`
  - target:
    - `POST /ai/generate-image`

- `edit-image`
  - target:
    - `POST /ai/edit-image`

- `image-to-prompt`
  - target:
    - `POST /ai/image-to-prompt`

- `ocr`
  - target:
    - `POST /ai/ocr`

## Billing

- `create-checkout`
  - target:
    - `POST /billing/checkout`

- `verify-payment`
  - target:
    - `POST /billing/payments/verify`

- `stripe-webhook`
  - target:
    - `POST /webhooks/stripe`

- `generate-invoice`
  - target:
    - `POST /billing/invoices/generate`

- `ksef-send-invoice`
  - target:
    - `POST /billing/ksef/send`

## Email

- `send-email`
  - target:
    - `POST /email/send`

## Jobs / Internal

- `daily-credits`
  - target:
    - `POST /internal/jobs/daily-credits`
  - should be protected by:
    - cron token or internal network

## Frontend Modules That Must Stop Using legacy-backend Directly

### Auth/session

- `src/pages/Auth.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Profile.tsx`
- `src/hooks/useAuth.ts`

### Graphics and gallery

- `src/pages/Gallery.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/RemoveBg.tsx`
- `src/pages/Filters.tsx`
- `src/pages/CropTool.tsx`
- `src/pages/Collage.tsx`
- `src/pages/TextOverlay.tsx`
- `src/pages/Editor.tsx`
- `src/pages/Templates.tsx`
- `src/pages/StyleTransfer.tsx`
- `src/pages/Upscale.tsx`
- `src/lib/graphicsLimit.ts`

### Admin data

- `src/components/AdminBadges.tsx`
- `src/components/AdminEmojis.tsx`
- `src/components/AdminPackages.tsx`
- `src/components/AdminToolPricing.tsx`
- `src/components/AdminEmails.tsx`
- `src/components/AdminContent.tsx`
- `src/components/AdminMailerLite.tsx`

## Suggested REST Groups On VPS

- `/auth/*`
- `/users/*`
- `/admin/*`
- `/ai/*`
- `/billing/*`
- `/email/*`
- `/storage/*`
- `/content/*`
- `/marketing/*`
- `/internal/jobs/*`

