/**
 * maskPhone — Restricted-PII display masking for list views.
 *
 * Masks all but the last 3 digits behind a fixed prefix so the real number
 * never renders by default (data-governance §4). Reveal must be an explicit,
 * permission-gated, server-audited action — not a client-only toggle.
 *
 * 012 345 678  -> *** *** 678
 * 1234         -> *** *** 234
 * 12           -> ***
 */
export function maskPhone(phone: string): string {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length < 4) return '***';
    return `*** *** ${digits.slice(-3)}`;
}
