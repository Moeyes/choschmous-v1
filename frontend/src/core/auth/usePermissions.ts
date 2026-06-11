/**
 * usePermissions — capability hook
 *
 * Centralizes "what can this role do?" behind named capabilities so components
 * ask `can(cap)` instead of hand-comparing `role === UserRole.ADMIN`. This is a
 * UX-only gate: it decides what controls/scoping to *show*. The server remains
 * the sole authority — it scopes data from the JWT regardless of what the UI
 * sends (see the organization-scoping enforcement on the backend).
 */
'use client';

import { useCallback } from 'react';
import { useAuth } from '@/core/auth/context';
import { UserRole } from '@/core/auth/types';

const { SUPER_ADMIN, ADMIN } = UserRole;

/** Named capabilities. Add new ones here rather than inlining role checks. */
export const CAPABILITIES = {
    /**
     * Operate across every organization rather than just the user's own:
     * unscoped list views, the organization selector, create-organization, and
     * the admin review queue. Granted to administrators.
     */
    CROSS_ORG_ADMIN: 'cross-org-admin',
    /**
     * Reveal Restricted-PII (e.g. a participant's phone) that is masked by
     * default. UX gate only — the server re-checks (admin-only) and audits
     * every reveal. Granted to administrators.
     */
    REVEAL_PII: 'reveal-pii',
} as const;

type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/** Which roles hold each capability. */
const CAPABILITY_ROLES: Record<Capability, UserRole[]> = {
    // Note: this now includes SUPER_ADMIN. The previous inline `role === ADMIN`
    // gates excluded super_admin (a latent bug), which contradicted
    // FEATURE_ACCESS where SUPER_ADMIN can reach every feature. Including it
    // here aligns the two.
    [CAPABILITIES.CROSS_ORG_ADMIN]: [SUPER_ADMIN, ADMIN],
    [CAPABILITIES.REVEAL_PII]: [SUPER_ADMIN, ADMIN],
};

export function usePermissions() {
    const { role } = useAuth();

    const can = useCallback(
        (capability: Capability): boolean =>
            !!role && CAPABILITY_ROLES[capability].includes(role),
        [role],
    );

    return { can };
}
