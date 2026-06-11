import type { Logger } from './logger.port';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Console-backed logger — the ONE place in the app permitted to call `console`.
 *
 * In development it surfaces event codes + non-PII meta to the console for
 * debugging. In production it is a deliberate no-op: this is the seam where a
 * secure server-side sink (audit log / APM) should be wired in. Until that
 * exists, we fail quiet rather than leak diagnostics to the user's browser
 * console. See `logger.port.ts` for the no-PII contract callers must honour.
 */
export const consoleLogger: Logger = {
  warn(event, meta) {
    if (!isDev) return;
    // eslint-disable-next-line no-console -- sanctioned logger boundary
    console.warn(`[warn] ${event}`, meta ?? {});
  },
  error(event, meta) {
    if (!isDev) return;
    // eslint-disable-next-line no-console -- sanctioned logger boundary
    console.error(`[error] ${event}`, meta ?? {});
  },
};
