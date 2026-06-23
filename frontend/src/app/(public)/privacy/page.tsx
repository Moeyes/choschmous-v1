import { PrivacyPage } from '@/modules/home';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy & Data Handling',
};

export default function Page() {
    return <PrivacyPage />;
}
