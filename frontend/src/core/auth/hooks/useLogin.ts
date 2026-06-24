'use client';

import { useState } from 'react';
import { useAuth } from '@/core/auth/context';
import { UserRole } from '@/core/auth/types';
import { MfaMethod, MfaRequiredError } from '@/core/auth/mfa';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';

export interface MfaChallengeState {
  mfaToken: string;
  methods: MfaMethod[];
  enrollmentRequired: boolean;
}

interface UseLoginReturn {
  login: (username: string, password: string) => Promise<UserRole | null>;
  /** Second leg: present a second factor for the active challenge. */
  submitMfa: (method: MfaMethod, code: string) => Promise<UserRole | null>;
  /** Abandon the current challenge and return to the password step. */
  cancelMfa: () => void;
  /** Non-null while the password step succeeded but a second factor is pending. */
  mfaChallenge: MfaChallengeState | null;
  isPending: boolean;
  error: string | null;
  /**
   * HTTP status of the last failed login, when available. Lets the form show
   * rate-limit/lockout messaging for 423 (Locked) / 429 (Too Many Requests)
   * instead of the generic error string.
   */
  status: number | null;
  clearError: () => void;
}

function axiosDetail(err: unknown): string | null {
  if (err instanceof AxiosError) {
    return err.response?.data?.detail || err.message;
  }
  return err instanceof Error ? err.message : null;
}

export function useLogin(): UseLoginReturn {
  const {
    login: contextLogin,
    completeMfa: contextCompleteMfa,
    clearError: contextClearError,
    error: contextError,
  } = useAuth();

  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeState | null>(null);

  const mutation = useMutation({
    // The login form renders its own inline error, so skip the global toast.
    meta: { suppressErrorToast: true },
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      return await contextLogin(username, password);
    },
  });

  const mfaMutation = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async ({ method, code }: { method: MfaMethod; code: string }) => {
      if (!mfaChallenge) throw new Error('No active MFA challenge');
      return await contextCompleteMfa(mfaChallenge.mfaToken, method, code);
    },
  });

  const login = async (username: string, password: string): Promise<UserRole | null> => {
    try {
      const role = await mutation.mutateAsync({ username, password });
      setMfaChallenge(null);
      return role;
    } catch (err) {
      // A correct password for an MFA-enrolled account: switch to the second-
      // factor step instead of reporting an error.
      if (err instanceof MfaRequiredError) {
        setMfaChallenge({
          mfaToken: err.mfaToken,
          methods: err.methods,
          enrollmentRequired: err.enrollmentRequired,
        });
        return null;
      }
      return null;
    }
  };

  const submitMfa = async (method: MfaMethod, code: string): Promise<UserRole | null> => {
    try {
      const role = await mfaMutation.mutateAsync({ method, code });
      setMfaChallenge(null);
      return role;
    } catch {
      return null;
    }
  };

  const cancelMfa = () => {
    setMfaChallenge(null);
    mfaMutation.reset();
    contextClearError();
  };

  // During the MFA step, surface the MFA mutation error; otherwise the login one
  // (an MfaRequiredError is a control-flow signal, never shown as an error).
  const rawError = mfaChallenge
    ? axiosDetail(mfaMutation.error)
    : mutation.error instanceof MfaRequiredError
      ? null
      : axiosDetail(mutation.error) ?? contextError;

  const activeError = mfaChallenge ? mfaMutation.error : mutation.error;
  const status =
    activeError instanceof AxiosError ? activeError.response?.status ?? null : null;

  return {
    login,
    submitMfa,
    cancelMfa,
    mfaChallenge,
    isPending: mutation.isPending || mfaMutation.isPending,
    error: typeof rawError === 'string' ? rawError : null,
    status,
    clearError: contextClearError,
  };
}
