import { GenderDistribution } from '../types';
import { SectionHeader, Card } from '@/shared';
import { PieChart, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface GenderChartProps {
    data: GenderDistribution;
}

// Distinct categorical hues from the design-token palette (blue / amber / teal).
const MALE_COLOR = 'hsl(var(--chart-1))';
const FEMALE_COLOR = 'hsl(var(--chart-2))';
const OTHER_COLOR = 'hsl(var(--chart-3))';

export function GenderChart({ data }: GenderChartProps) {
    const t = useTranslations('dashboard');
    const total = data.male + data.female + data.other;

    if (total === 0) return (
        <Card className="flex flex-col h-full">
            <SectionHeader title={t('genderDistribution')} icon={PieChart} />
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-text">
                {t('noOrganizationData')}
            </div>
        </Card>
    );

    const malePerc = (data.male / total) * 100;
    const femalePerc = (data.female / total) * 100;
    const otherPerc = (data.other / total) * 100;

    const size = 180;
    const center = size / 2;
    const radius = 68;
    const strokeWidth = 22;
    const circumference = 2 * Math.PI * radius;

    const maleOffset = 0;
    const femaleOffset = (malePerc / 100) * circumference;
    const otherOffset = ((malePerc + femalePerc) / 100) * circumference;

    const segments = [
        { key: 'male', label: t('male'), color: MALE_COLOR, perc: malePerc },
        { key: 'female', label: t('female'), color: FEMALE_COLOR, perc: femalePerc },
        { key: 'other', label: t('other'), color: OTHER_COLOR, perc: otherPerc },
    ];

    const ariaLabel = `${t('genderDistribution')}: ${segments
        .map((s) => `${s.label} ${s.perc.toFixed(1)}%`)
        .join(', ')}`;

    return (
        <Card className="flex flex-col h-full">
            <SectionHeader title={t('genderDistribution')} icon={PieChart} subtitle={t('totalMembers', { count: total })} />
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="relative">
                    <svg
                        width={size}
                        height={size}
                        viewBox={`0 0 ${size} ${size}`}
                        className="-rotate-90"
                        role="img"
                        aria-label={ariaLabel}
                    >
                        <title>{t('genderDistribution')}</title>
                        <desc>{ariaLabel}</desc>
                        <circle
                            cx={center} cy={center} r={radius}
                            fill="none"
                            stroke={OTHER_COLOR}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${(otherPerc / 100) * circumference} ${circumference}`}
                            strokeDashoffset={-otherOffset}
                            className="transition-all duration-1000 ease-out"
                        >
                            <title>{`${t('other')} ${otherPerc.toFixed(1)}%`}</title>
                        </circle>
                        <circle
                            cx={center} cy={center} r={radius}
                            fill="none"
                            stroke={FEMALE_COLOR}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${(femalePerc / 100) * circumference} ${circumference}`}
                            strokeDashoffset={-femaleOffset}
                            className="transition-all duration-1000 ease-out"
                        >
                            <title>{`${t('female')} ${femalePerc.toFixed(1)}%`}</title>
                        </circle>
                        <circle
                            cx={center} cy={center} r={radius}
                            fill="none"
                            stroke={MALE_COLOR}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${(malePerc / 100) * circumference} ${circumference}`}
                            strokeDashoffset={-maleOffset}
                            className="transition-all duration-1000 ease-out"
                        >
                            <title>{`${t('male')} ${malePerc.toFixed(1)}%`}</title>
                        </circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Users className="h-5 w-5 text-muted-text mb-1" aria-hidden />
                        <span className="text-3xl font-bold text-heading tracking-tight">{total}</span>
                        <span className="text-xs text-muted-text">{t('total')}</span>
                    </div>
                </div>
                <ul className="mt-6 grid grid-cols-3 gap-4 w-full max-w-xs">
                    {segments.map((s) => (
                        <li key={s.key} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/50">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                            <span className="text-sm font-semibold text-heading">{s.perc.toFixed(1)}%</span>
                            <span className="text-xs text-muted-text">{s.label}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </Card>
    );
}
