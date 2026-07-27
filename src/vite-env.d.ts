/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HMAC_SECRET: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STORAGE_ENCRYPTION_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
