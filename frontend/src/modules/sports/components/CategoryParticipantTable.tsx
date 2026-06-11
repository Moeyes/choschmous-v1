'use client';

import { useTranslations } from 'next-intl';
import { User as UserIcon, Loader2, Eye } from 'lucide-react';
import { Badge } from '@/shared';
import { usePermissions, CAPABILITIES } from '@/core/auth';
import { useRevealParticipantPhone } from '@/modules/registration/hooks';
import type { SportParticipant } from '../types';

/**
 * Phone is Restricted-PII and is not sent with the list (data minimization).
 * Admins can fetch it on demand via the audited reveal endpoint; everyone else
 * sees nothing. participant_id is the enroll_id the reveal endpoint expects.
 */
function RevealablePhone({ enrollId }: { enrollId: number }) {
  const t = useTranslations('sports.participants');
  const { can } = usePermissions();
  const reveal = useRevealParticipantPhone();

  if (!can(CAPABILITIES.REVEAL_PII)) return null;

  if (reveal.data) {
    return <span className="text-[11px] text-muted-foreground">{reveal.data.phone}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => reveal.mutate(enrollId)}
      disabled={reveal.isPending}
      className="flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
    >
      <Eye className="h-3 w-3" />
      {reveal.isPending ? t('revealing') : t('revealPhone')}
    </button>
  );
}

function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

interface CategoryParticipantTableProps {
  rows: SportParticipant[];
  isLoading: boolean;
  eventName: (id?: number | null) => string | null;
}

export function CategoryParticipantTable({ rows, isLoading, eventName }: CategoryParticipantTableProps) {
  const t = useTranslations('sports.participants');

  if (isLoading) {
    return (
      <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('noResults')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="p-3 font-semibold">{t('columns.participant')}</th>
            <th className="p-3 font-semibold">{t('columns.type')}</th>
            <th className="p-3 font-semibold">{t('columns.age')}</th>
            <th className="p-3 font-semibold">{t('columns.gender')}</th>
            <th className="p-3 font-semibold">{t('columns.organization')}</th>
            <th className="p-3 font-semibold">{t('columns.event')}</th>
            <th className="p-3 font-semibold">{t('columns.detail')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => {
            const age = ageFromDob(p.date_of_birth);
            return (
              <tr key={`${p.role}-${p.participant_id}`} className="hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{p.name_kh?.trim() || p.name_en}</span>
                      <RevealablePhone enrollId={p.participant_id} />
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={p.role === 'athlete' ? 'info' : 'secondary'}>
                    {t(`types.${p.role}`)}
                  </Badge>
                </td>
                <td className="p-3 text-sm text-foreground">{age ?? '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">{p.gender || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">{p.organization?.name || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">{eventName(p.event_id) || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">
                  {p.role === 'athlete'
                    ? p.category?.name || '—'
                    : p.leader_role
                      ? p.leader_role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                      : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
