'use client';

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { User as UserIcon, Eye, UsersRound, RotateCcw } from 'lucide-react';
import { Badge } from '@/shared';
import { Skeleton } from '@/shared/ui/Skeleton';
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
      onClick={(e) => {
        e.stopPropagation();
        reveal.mutate(enrollId);
      }}
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

type GenderKind = 'male' | 'female' | 'other' | null;

function genderKind(gender?: string | null): GenderKind {
  const g = gender?.toUpperCase();
  if (g === 'MALE') return 'male';
  if (g === 'FEMALE') return 'female';
  if (g === 'OTHER') return 'other';
  return null;
}

/** Localized, colour-coded gender pill (mirrors the category list's badge). */
function GenderPill({ gender }: { gender?: string | null }) {
  const t = useTranslations('sports.categories.genders');
  const kind = genderKind(gender);
  if (!kind) return <span className="text-sm text-muted-foreground">—</span>;
  const config: Record<Exclude<GenderKind, null>, string> = {
    male: 'bg-blue-100 text-blue-700 border-blue-200',
    female: 'bg-pink-100 text-pink-700 border-pink-200',
    other: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config[kind]}`}>{t(kind)}</span>;
}

interface CategoryParticipantTableProps {
  rows: SportParticipant[];
  isLoading: boolean;
  eventName: (id?: number | null) => string | null;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  /** When provided, each row is clickable and opens the participant detail. */
  onParticipantClick?: (participant: SportParticipant) => void;
}

export function CategoryParticipantTable({ rows, isLoading, eventName, hasActiveFilters, onResetFilters, onParticipantClick }: CategoryParticipantTableProps) {
  const t = useTranslations('sports.participants');
  const tCommon = useTranslations('common');

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted/50 p-3">
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="ml-auto h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UsersRound className="h-6 w-6 text-muted-foreground" />
        </span>
        <p className="text-sm font-semibold text-foreground">{hasActiveFilters ? t('filteredEmptyTitle') : t('emptyTitle')}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{hasActiveFilters ? t('filteredEmptyHint') : t('emptyHint')}</p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('resetFilters')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-160 border-collapse text-left">
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
          {rows.map((p, i) => {
            const age = ageFromDob(p.date_of_birth);
            const kind = genderKind(p.gender);
            const avatarTint = kind === 'male' ? 'bg-blue-100 text-blue-600' : kind === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-muted text-muted-foreground';
            const clickable = !!onParticipantClick;
            return (
              <tr
                key={`${p.role}-${p.participant_id}-${i}`}
                className={`group hover:bg-muted/30 ${clickable ? 'cursor-pointer' : ''}`}
                onClick={clickable ? () => onParticipantClick!(p) : undefined}
                {...(clickable
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      onKeyDown: (e: ReactKeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onParticipantClick!(p);
                        }
                      },
                    }
                  : {})}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${avatarTint}`}>
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold text-foreground ${clickable ? 'group-hover:text-primary' : ''}`}>{p.name_kh?.trim() || p.name_en}</span>
                      <RevealablePhone enrollId={p.participant_id} />
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={p.role === 'athlete' ? 'info' : 'secondary'}>{p.role === 'athlete' ? tCommon('athlete') : tCommon('leader')}</Badge>
                </td>
                <td className="p-3 text-sm text-foreground">{age != null ? `${age} ${t('yearsUnit')}` : '—'}</td>
                <td className="p-3">
                  <GenderPill gender={p.gender} />
                </td>
                <td className="p-3 text-sm text-muted-foreground">{p.organization?.name || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">{eventName(p.event_id) || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">
                  {p.role === 'athlete' ? p.category?.name || '—' : p.leader_role ? p.leader_role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
