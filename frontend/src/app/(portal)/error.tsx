'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { PageEmptyState } from '@/shared/ui/page/PageEmptyState';
import { apiErrorKey } from '@/shared/utils/apiError';
import { logger } from '@/core/lib/logger';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');

  useEffect(() => {
    // Diagnostics only — log a stable code + digest, never the raw error.
    logger.error('portal.error_boundary', { digest: error.digest });
  }, [error]);

  // Map the error to a generic, translated message. Raw error.message is no
  // longer rendered — it can leak internals and is never localized.
  const description = t(apiErrorKey(error));

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <PageEmptyState
        icon={AlertTriangle}
        title={t('title')}
        description={description}
        action={
          <div className="flex items-center gap-3">
            <Button onClick={reset} variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              {t('tryAgain')}
            </Button>
            <Link href="/dashboard">
              <Button className="gap-2">
                <Home className="h-4 w-4" />
                {t('goToDashboard')}
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
