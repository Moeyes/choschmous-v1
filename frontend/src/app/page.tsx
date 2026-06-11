import { HomePage } from '@/modules/home';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
};

export default function Page() {
    return <HomePage />;
}
