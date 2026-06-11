/**
 * maskNationalId — Restricted-PII display masking for list/detail views.
 *
 * Reveals only the last 4 characters behind a fixed prefix (data-governance §4).
 * Reveal of the full value must be an explicit, permission-gated, server-audited
 * action — never a client-only toggle.
 *
 * 010203040506 -> **** **** 0506
 * AB12         -> ***
 */
export function maskNationalId(id: string): string {
    const s = (id ?? '').trim();
    if (s.length <= 4) return '***';
    return `**** **** ${s.slice(-4)}`;
}
