import { AccessibilityPage } from '@/modules/home';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Accessibility Statement',
};

export default function Page() {
    return <AccessibilityPage />;
}
