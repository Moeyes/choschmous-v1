export { consoleLogger as logger } from './consoleLogger';

// CHOS-204: W3C trace propagation. The API client mints a trace context per
// request and sets it current so the logger stamps the trace id and the
// `traceparent` header continues the trace on the backend.
export {
    createTraceContext,
    setCurrentTrace,
    getCurrentTrace,
} from './traceContext';
export type { TraceContext } from './traceContext';
