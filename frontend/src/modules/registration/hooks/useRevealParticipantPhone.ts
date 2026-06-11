'use client';

import { useMutation } from '@tanstack/react-query';
import { registrationRepository } from '../adapters';

/**
 * Reveal a participant's masked phone on demand. The server enforces admin-only
 * access and writes an audit record per call (data-governance §4/§6); this hook
 * just triggers it. UI must still gate the affordance behind CAPABILITIES.REVEAL_PII.
 *
 * Not cached — each reveal is a fresh, audited request (no staleTime/gcTime).
 */
export function useRevealParticipantPhone() {
    return useMutation({
        mutationFn: (enrollId: number) => registrationRepository.revealPhone(enrollId),
    });
}
