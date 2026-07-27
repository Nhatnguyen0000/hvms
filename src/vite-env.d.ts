/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HMAC_SECRET: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_SERVICE_KEY: string;
  readonly VITE_STORAGE_ENCRYPTION_KEY: string;
  readonly GEMINI_API_KEY: string;
  readonly APP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
