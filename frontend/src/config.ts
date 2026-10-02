// Backend base URL, configurable at build/dev time via VITE_API_BASE_URL (see .env.example).
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
