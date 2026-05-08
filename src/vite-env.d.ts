/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_ANTHROPIC_MODEL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_MODEL?: string;
  /** "true" to start the app in offline / template mode by default. */
  readonly VITE_USE_DEMO_MODE?: string;
  /** Adzuna job search API — free signup at https://developer.adzuna.com/ */
  readonly VITE_ADZUNA_APP_ID?: string;
  readonly VITE_ADZUNA_APP_KEY?: string;
  /** Optional — bumps The Muse rate limit from 500/hr to 3,600/hr */
  readonly VITE_MUSE_API_KEY?: string;
  /** JSearch (RapidAPI) — free tier covers Indeed + LinkedIn + Google for Jobs. */
  readonly VITE_JSEARCH_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// pdfjs ships its worker as an .mjs file; we import its URL via Vite's `?url` suffix.
declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
  const url: string;
  export default url;
}

// Mammoth ships a browser bundle that lacks bundled types in some setups.
declare module 'mammoth/mammoth.browser' {
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}
