'use client';

'use client';

import { useTranslations } from 'next-intl';
import { LayoutGrid, Medal, GraduationCap, Baby, type LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, RadioCardGroup } from '@/shared';
import type { RadioCardOption } from '@/shared';

interface ByNumberEventTypeStepProps {
    eventTypes: { id: string; name_kh: string }[];
    eventTypeIcons?: Record<string, string>;
    selectedEventType?: string | null;
    onSelectEventType?: (id: string) => void;
}

const iconMap: Record<string, LucideIcon> = {
  Trophy: Medal,
  CalendarDays: Medal,
  Building2: Medal,
  LayoutGrid: Medal,
  GraduationCap,
  Baby,
};

export function ByNumberEventTypeStep({ eventTypes, eventTypeIcons = {}, selectedEventType, onSelectEventType }: ByNumberEventTypeStepProps) {
    const t = useTranslations('bynumber');

    const options: RadioCardOption[] = eventTypes.map((type) => {
      const iconName = eventTypeIcons[type.id] || 'Trophy';
      const Icon = iconMap[iconName] || Medal;
      return {
        value: type.id,
        label: type.name_kh,
        icon: Icon,
      };
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle icon={LayoutGrid} subtitle={t('subtitle')}>
            {t('headings.event_type')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioCardGroup
            options={options}
            value={selectedEventType}
            onChange={(id) => onSelectEventType?.(id)}
          />
        </CardContent>
      </Card>
    );
}
