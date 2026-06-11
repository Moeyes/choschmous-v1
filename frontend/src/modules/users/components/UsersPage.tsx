'use client';

import { PageShell } from '@/shared';
import { UserList } from './UserList';

export function UsersPage() {
    return (
        <PageShell padded={false} size="wide">
            <UserList />
        </PageShell>
    );
}
