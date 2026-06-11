import { Metadata } from 'next';
import { EventDetailPage } from '@/modules/events';
import { eventsRepository } from '@/modules/events/adapters';

interface PageProps {
    params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { eventId } = await params;
    try {

        const event = await eventsRepository.getPublicById(Number(eventId));
        return {
            title: event?.name || 'Event Detail',
        };
    } catch {
        return { title: 'Event Detail' };
    }
}

export default async function Page({ params }: PageProps) {
    const { eventId } = await params;
    return <EventDetailPage eventId={Number(eventId)} />;
}
