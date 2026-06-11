import { Metadata } from 'next';
import { SportDetailPage } from '@/modules/sports';
import { sportsRepository } from '@/modules/sports/adapters';

interface PageProps {
    params: Promise<{ sportId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { sportId } = await params;
    try {
        const sport = await sportsRepository.getById(Number(sportId));
        return { 
            title: sport?.name_kh || 'Sport Detail',
        };
    } catch {
        return { title: 'Sport Detail' };
    }
}

export default async function Page({ params }: PageProps) {
    const { sportId } = await params;
    return <SportDetailPage sportId={Number(sportId)} />;
}
