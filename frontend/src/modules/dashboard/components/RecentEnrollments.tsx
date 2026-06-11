import { RecentEnrollment } from '../types';
import { User, Calendar, Clock } from 'lucide-react';
import { DataTable, SectionHeader, Card, Badge } from '@/shared';
import { useTranslations } from 'next-intl';

interface RecentEnrollmentsProps {
    data: RecentEnrollment[];
}

export function RecentEnrollments({ data }: RecentEnrollmentsProps) {
    const t = useTranslations('dashboard');
    const tCommon = useTranslations('common');

    return (
        <Card className="flex flex-col h-full">
            <SectionHeader
                title={t('recentEnrollments')}
                icon={Calendar}
                subtitle={`${data.length} recent registrations`}
            />
            <div className="flex-1">
                <DataTable
                    data={data}
                    minWidth="min-w-0"
                    emptyMessage={t('noRecentEnrollments')}
                    cardMode={true}
                    columns={[
                        {
                            header: t('members'),
                            mobileLabel: t('members'),
                            accessor: (enroll) => (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50">
                                        <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-heading leading-snug">
                                            {enroll.khName}
                                        </p>
                                        <p className="truncate text-xs text-muted-text leading-relaxed">
                                            {enroll.enName}
                                        </p>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            header: t('genderDistribution'),
                            mobileLabel: t('genderDistribution'),
                            accessor: (enroll) => (
                                <Badge variant={enroll.gender === 'Male' || enroll.gender === 'ប្រុស' ? 'success' : 'info'} size="xs">
                                    {enroll.gender}
                                </Badge>
                            ),
                            hideOnMobile: true,
                        },
                        {
                            header: tCommon('to'),
                            mobileLabel: tCommon('to'),
                            align: 'right',
                            accessor: (enroll) => (
                                <div className="flex items-center gap-1.5 text-xs text-muted-text">
                                    <Clock className="h-3 w-3" />
                                    {new Date(enroll.createdAt).toLocaleDateString()}
                                </div>
                            ),
                        },
                    ]}
                />
            </div>
        </Card>
    );
}
