/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_CLIENT_ID?: string;
  readonly VITE_AZURE_AUTHORITY?: string;
  readonly VITE_AZURE_REDIRECT_URI?: string;
  readonly VITE_ELITE_GROUP_ID?: string;
  readonly VITE_ENV?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

