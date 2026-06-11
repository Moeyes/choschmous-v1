'use client';

import { PageShell } from '@/shared';
import { SportList } from './SportList';

export function SportsPage() {
    return (
        <PageShell padded={false} size="wide">
            <SportList />
        </PageShell>
    );
}
