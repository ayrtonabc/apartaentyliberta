/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly RESEND_API_KEY: string;
  readonly OWNER_EMAIL: string;
  readonly OWNER_PHONE: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_SITE_NAME: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY: string;
  readonly TURNSTILE_SECRET_KEY: string;
  readonly PUBLIC_GA4_MEASUREMENT_ID: string;
  readonly SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
