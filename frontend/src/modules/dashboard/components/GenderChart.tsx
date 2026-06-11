import { GenderDistribution } from '../types';
import { SectionHeader, Card } from '@/shared';
import { PieChart, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface GenderChartProps {
    data: GenderDistribution;
}

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

    const maleColor = "hsl(var(--primary))";
    const femaleColor = "hsl(var(--secondary))";
    const otherColor = "hsl(var(--muted-foreground) / 0.3)";

    return (
        <Card className="flex flex-col h-full">
            <SectionHeader title={t('genderDistribution')} icon={PieChart} subtitle={`${total} total members`} />
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="relative">
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                        <circle
                            cx={center} cy={center} r={radius}
                            fill="none"
                            stroke={otherColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${(otherPerc / 100) * circumference} ${circumference}`}
                            strokeDashoffset={-otherOffset}
                            className="transition-all duration-1000 ease-out"
                        />
                        <circle
                            cx={center} cy={center} r={radius}
                            fill="none"
                            stroke={femaleColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${(femalePerc / 100) * circumference} ${circumference}`}
                            strokeDashoffset={-femaleOffset}
                            className="transition-all duration-1000 ease-out"
                        />
                        <circle
                            cx={center} cy={center} r={radius}
                            fill="none"
                            stroke={maleColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${(malePerc / 100) * circumference} ${circumference}`}
                            strokeDashoffset={-maleOffset}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Users className="h-5 w-5 text-muted-text mb-1" />
                        <span className="text-3xl font-bold text-heading tracking-tight">{total}</span>
                        <span className="text-xs text-muted-text">total</span>
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4 w-full max-w-xs">
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/50">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: maleColor }} />
                        <span className="text-sm font-semibold text-heading">{malePerc.toFixed(1)}%</span>
                        <span className="text-xs text-muted-text">{t('male')}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/50">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: femaleColor }} />
                        <span className="text-sm font-semibold text-heading">{femalePerc.toFixed(1)}%</span>
                        <span className="text-xs text-muted-text">{t('female')}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/50">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: otherColor }} />
                        <span className="text-sm font-semibold text-heading">{otherPerc.toFixed(1)}%</span>
                        <span className="text-xs text-muted-text">{t('other')}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
