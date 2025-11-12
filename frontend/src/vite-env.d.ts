/// <reference types="vite/client" />

// Optional: declare the specific VITE_ vars we use for better intellisense
interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
