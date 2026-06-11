/**
 * app/(portal)/users/page.tsx — Server Component
 *
 * Route entry point. No business logic, no hooks, no state.
 * Auth + SUPER_ADMIN enforcement happens server-side (middleware + API layer).
 * The previous useRequireRole() was a UX-only client gate; it did not add
 * security and violates the Next.js App Router rule that page.tsx must be a
 * Server Component.
 */
import { UsersPage } from '@/modules/users';

export default function UsersRoute() {
    return <UsersPage />;
}
