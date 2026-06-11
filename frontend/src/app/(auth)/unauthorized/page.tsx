import { UnauthorizedPage } from '@/modules/common';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unauthorized',
};

export default function Page() {
    return <UnauthorizedPage />;
}
