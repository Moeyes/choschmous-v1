import { AxiosError } from "axios";

/**
 * Module-level localized fallback strings for mutation toasts.
 *
 * Toast handlers live in the React Query MutationCache, which runs outside the
 * React tree and therefore cannot call `useTranslations()`. `ToastI18nBridge`
 * keeps these values in sync with the active locale so global toasts stay
 * localized without every hook wiring its own messages.
 */
export const toastFallback = {
  error: "Something went wrong. Please try again.",
};

interface FastAPIErrorBody {
  detail?: string | { msg?: string }[] | unknown;
  code?: unknown;
}

/**
 * Generic message key under the `errors` i18n namespace, used when no specific
 * backend code maps to a dedicated message.
 */
const GENERIC_ERROR_KEY = "generic";

/**
 * Backend error `code` → key under the `errors` i18n namespace.
 *
 * The backend does not yet emit stable machine codes, so this map is
 * intentionally empty and everything routes to the generic message. As the API
 * contract firms up, add one row per code here — no call sites change.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  // Example (once the backend emits codes):
  // ORG_NOT_FOUND: "orgNotFound",
};

function extractApiErrorCode(error: unknown): string | null {
  if (error instanceof AxiosError) {
    const data = error.response?.data as FastAPIErrorBody | undefined;
    if (typeof data?.code === "string" && data.code) return data.code;
  }
  return null;
}

/**
 * Resolve any error to a translation key under the `errors` namespace. Falls
 * back to {@link GENERIC_ERROR_KEY} when the error carries no known backend
 * code (e.g. render errors caught by a Next error boundary).
 */
export function apiErrorKey(error: unknown): string {
  const code = extractApiErrorCode(error);
  return (code && ERROR_CODE_KEYS[code]) || GENERIC_ERROR_KEY;
}
