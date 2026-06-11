'use client';

import { PageShell } from '@/shared';
import { EventList } from './EventList';

export function EventsPage() {
    return (
        <PageShell padded={false} size="wide">
            <EventList />
        </PageShell>
    );
}
