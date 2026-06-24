import type { Logger } from './logger.port';
import { getCurrentTrace } from './traceContext';

const isDev = process.env.NODE_ENV !== 'production';

type LogMeta = Record<string, string | number | boolean | undefined>;

/**
 * Stamp the active request's trace id (CHOS-204) onto the log meta so a client
 * log line correlates with its backend trace/logs by `traceId`. The trace id is
 * a random, non-PII identifier, so it stays within the logger's no-PII contract.
 */
function withTrace(meta?: LogMeta): LogMeta {
  const traceId = getCurrentTrace()?.traceId;
  return traceId ? { ...(meta ?? {}), traceId } : (meta ?? {});
}

/**
 * Console-backed logger — the ONE place in the app permitted to call `console`.
 *
 * In development it surfaces event codes + non-PII meta (incl. the trace id) to
 * the console for debugging. In production it is a deliberate no-op: this is the
 * seam where a secure server-side sink (audit log / APM) should be wired in.
 * Until that exists, we fail quiet rather than leak diagnostics to the user's
 * browser console. See `logger.port.ts` for the no-PII contract callers honour.
 */
export const consoleLogger: Logger = {
  warn(event, meta) {
    if (!isDev) return;
    // eslint-disable-next-line no-console -- sanctioned logger boundary
    console.warn(`[warn] ${event}`, withTrace(meta));
  },
  error(event, meta) {
    if (!isDev) return;
    // eslint-disable-next-line no-console -- sanctioned logger boundary
    console.error(`[error] ${event}`, withTrace(meta));
  },
};
