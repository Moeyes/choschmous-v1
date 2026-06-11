/**
 * maskEmail — Restricted-PII display masking for list views.
 *
 * pa***@***.com  (panha@example.com)
 * a***@***.co   (a@b.co)
 * ***            (invalid input)
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    const maskedLocal  = local.length <= 2 ? local + '***' : local.slice(0, 2) + '***';
    const dotIndex     = domain.lastIndexOf('.');
    const maskedDomain = dotIndex > 0 ? '***' + domain.slice(dotIndex) : '***';
    return `${maskedLocal}@${maskedDomain}`;
}
