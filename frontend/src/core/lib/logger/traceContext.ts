/**
 * W3C Trace Context generation + propagation (CHOS-204).
 *
 * Produces a `traceparent` so a browser action and its backend span share one
 * `trace_id`. The backend's OpenTelemetry FastAPI instrumentation extracts this
 * header (tracecontext propagator) and makes the server span a child of the
 * client trace, so a request is traceable end-to-end and its structured logs
 * (client + server) correlate by `trace_id`.
 *
 * Format: `00-<32 hex trace_id>-<16 hex span_id>-01`
 */

export interface TraceContext {
    /** 16-byte trace id, 32 hex chars. */
    traceId: string;
    /** 8-byte span id, 16 hex chars. */
    spanId: string;
    /** The `traceparent` header value. */
    traceparent: string;
}

function randomHex(bytes: number): string {
    const buf = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(buf);
    } else {
        for (let i = 0; i < bytes; i += 1) buf[i] = Math.floor(Math.random() * 256);
    }
    let out = '';
    for (const b of buf) out += b.toString(16).padStart(2, '0');
    return out;
}

/** Mint a fresh sampled trace context for one logical request. */
export function createTraceContext(): TraceContext {
    const traceId = randomHex(16);
    const spanId = randomHex(8);
    return { traceId, spanId, traceparent: `00-${traceId}-${spanId}-01` };
}

// The trace context of the request currently being issued. Set by the API
// client's header interceptor and read by the logger so client logs emitted
// while a request is in flight carry its trace id without threading it through
// every call site. Best-effort (a module-level "current") — adequate for
// browser-side correlation.
let current: TraceContext | null = null;

export function setCurrentTrace(ctx: TraceContext | null): void {
    current = ctx;
}

export function getCurrentTrace(): TraceContext | null {
    return current;
}
