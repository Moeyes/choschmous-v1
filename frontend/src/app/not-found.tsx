import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { PageNotFound as PageNotFoundComponent } from '@/shared/ui/page/PageNotFound';

export default function NotFound() {
  return (
    <PageNotFoundComponent
      title="Page Not Found"
      description="The page you are looking for does not exist or has been moved."
      action={
        <Link href="/dashboard">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            Go to dashboard
          </Button>
        </Link>
      }
    />
  );
}
