'use client';

import { ClipboardList } from 'lucide-react';
import { PageHeader, PageShell } from '@/shared';
import { useTranslations } from 'next-intl';
import { ParticipantList } from './ParticipantList';

/**
 * Read-only list of everyone registered (athletes + leaders) via the
 * registration flows. Backed by GET /api/registration/ through ParticipantList.
 */
export function RegistrationsPage() {
  const t = useTranslations('registration.list');

  return (
    <PageShell size="wide">
      <PageHeader title={t('title')} description={t('subtitle')} icon={ClipboardList} />
      <ParticipantList />
    </PageShell>
  );
}
