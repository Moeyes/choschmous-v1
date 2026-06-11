'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, Building2, Trophy, ListChecks, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useAuth, UserRole } from '@/core/auth';
import { surveyRepository } from '../adapters';
import { bynumberRepository } from '@/modules/bynumber/adapters';
import type { Event, Organization } from '../types';

/**
 * Read-only view of the sports an organization has registered for (the "By
 * Sport" survey result). Reuses fetchOrgEventSports, which resolves the
 * sports_event_org links via existing endpoints.
 */
export function BySportRecords() {
  const t = useTranslations('survey.records');
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [events, setEvents] = useState<Event[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [orgId, setOrgId] = useState<number | null>(!isAdmin && user?.org_id ? user.org_id : null);
  const [sports, setSports] = useState<{ sport_id: number; sport_name_kh: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Load events + organizations once.
  useEffect(() => {
    let active = true;
    surveyRepository.fetchSurveyData().then(({ events, organizations }) => {
      if (!active) return;
      setEvents(events);
      setOrganizations(organizations);
    });
    return () => {
      active = false;
    };
  }, []);

  // Load registered sports whenever both org and event are chosen.
  useEffect(() => {
    if (!eventId || !orgId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    bynumberRepository.fetchOrgEventSports(orgId, eventId)
      .then((rows) => {
        if (active) {
          setSports(rows.map((r) => ({ sport_id: r.sport_id, sport_name_kh: r.sport_name_kh })));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [eventId, orgId]);

  const eventOptions = useMemo(() => events, [events]);

  // Triggers must display the name, not the captured id (Base UI renders the raw value otherwise).
  const selectedOrgName = organizations.find((o) => o.id === orgId)?.name_kh;
  const selectedEventName = eventOptions.find((e) => e.id === eventId)?.name_kh;

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isAdmin && (
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              {t('orgLabel')}
            </label>
            <Select value={orgId ? String(orgId) : ''} onValueChange={(v) => setOrgId(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectOrg')}>{selectedOrgName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.name_kh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            {t('eventLabel')}
          </label>
          <Select value={eventId ? String(eventId) : ''} onValueChange={(v) => setEventId(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectEvent')}>{selectedEventName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {eventOptions.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name_kh}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
          {sports.length > 0 && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{sports.length}</span>}
        </div>

        {!eventId || !orgId ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
            {t('selectPrompt')}
          </div>
        ) : loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">{t('loading')}</div>
        ) : sports.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm italic text-muted-foreground">{t('empty')}</div>
        ) : (
          <ul className="divide-y divide-border">
            {sports.map((s) => (
              <li key={s.sport_id} className="flex items-center gap-3 px-5 py-3">
                <Trophy className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">{s.sport_name_kh}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
