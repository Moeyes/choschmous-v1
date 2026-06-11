/**
 * Logger port — the application's only sanctioned diagnostics boundary.
 *
 * Security contract (national-frontend-architecture · security §9, Golden Rule 20):
 * - Callers pass a STABLE EVENT CODE (e.g. `'auth.unknown_role'`), never a
 *   free-text message built from runtime values.
 * - `meta` carries ONLY non-PII operational context (HTTP status, route name,
 *   Next.js error digest, boolean flags). It must NEVER contain raw error
 *   objects, payloads, names, emails, IDs, tokens, or anything user-identifying.
 *
 * Anything sensitive stays out of here by construction — the type below makes
 * passing a raw object awkward on purpose.
 */
type LogMeta = Record<string, string | number | boolean | undefined>;

export interface Logger {
  warn(event: string, meta?: LogMeta): void;
  error(event: string, meta?: LogMeta): void;
}
