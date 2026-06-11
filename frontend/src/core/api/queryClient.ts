/**
 * Shared TanStack Query client (single instance for the whole app).
 *
 * Lives here, outside the React tree, so non-component code can reach it — in
 * particular `core/auth` calls `queryClient.clear()` on logout/session-expiry to
 * wipe any PII-bearing query cache (data-governance §5). `AuthProvider` sits
 * above `QueryProvider` in the tree, so it cannot use `useQueryClient()`; it
 * imports this singleton directly instead.
 *
 * The global MutationCache means:
 *  - every failed mutation surfaces an error toast automatically, and
 *  - mutations that opt in via `meta.successMessage` show a success toast.
 * Its callbacks run outside the React tree, so they read the locale-synced
 * `toastFallback` (kept current by `ToastI18nBridge`) rather than hooks.
 *
 * The global `onSuccess` also invalidates the dashboard after *every* mutation.
 * Dashboard KPIs aggregate data owned by many modules (events, organizations,
 * registrations, participations, …), so any create/update/delete can change
 * them. Centralising the invalidation here means a new mutation hook gets
 * dashboard auto-refresh for free — no per-hook wiring to forget. Invalidation
 * only refetches *mounted* dashboard queries; when the dashboard isn't on
 * screen the keys are merely marked stale, so this is effectively free.
 */
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { toastFallback } from '@/shared/utils/apiError';
import { queryKeys } from './queryKeys';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
  mutationCache: new MutationCache({
    onError: (_error, _vars, _ctx, mutation) => {
      if (mutation.meta?.suppressErrorToast) return;
      // Never surface the raw backend message — it can leak internal detail/PII
      // (security §9). Show a per-mutation translated message if the hook set
      // one, otherwise the locale-synced generic fallback.
      const message = (mutation.meta?.errorMessage as string | undefined) ?? toastFallback.error;
      toast.error(message);
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const success = mutation.meta?.successMessage as string | undefined;
      if (success) toast.success(success);

      // Keep dashboard metrics in sync after any write, unless the hook opts
      // out via meta.skipDashboardInvalidation (e.g. non-data mutations like
      // login or reveal-phone that can never change an aggregate).
      if (!mutation.meta?.skipDashboardInvalidation) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      }
    },
  }),
});
