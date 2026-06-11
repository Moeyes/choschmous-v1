'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
    User, Phone, Calendar, Trophy, Building2, FileText,
    Eye, EyeOff, Shield, BadgeCheck, ExternalLink, Pencil,
} from 'lucide-react';
import {
    DetailHeader, ContentPanel, PageLoadingState, PageNotFound, PageShell, Badge,
} from '@/shared';
import { Button } from '@/shared/ui/button';
import { useRegistration } from '../hooks';
import { ParticipantEditForm } from './ParticipantEditForm';
import type { ParticipantDetailRecord } from '../types';

interface ParticipantDetailProps {
    enrollId: number;
    role: string;
}

function maskPhone(phone: string): string {
    if (phone.length <= 3) return '•••';
    return `${'•'.repeat(Math.max(0, phone.length - 3))}${phone.slice(-3)}`;
}

export function ParticipantDetail({ enrollId, role }: ParticipantDetailProps) {
    const t = useTranslations('registration.detail');
    const tCommon = useTranslations('common');
    const { data, isLoading } = useRegistration(enrollId, role);
    const [phoneShown, setPhoneShown] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    if (isLoading) return <PageLoadingState />;
    if (!data) {
        return (
            <PageNotFound
                title={t('notFoundTitle')}
                description={t('notFoundDescription')}
            />
        );
    }

    const p = data as ParticipantDetailRecord;
    const nameLatin = p.name_en || `${p.en_family_name} ${p.en_given_name}`;
    const nameKhmer = p.name_kh || `${p.kh_family_name} ${p.kh_given_name}`;
    const isLeader = p.role === 'leader';
    const dash = '—';

    const documents = [
        { label: t('documents.photo'), url: p.photoUrl ?? p.photo_url },
        { label: t('documents.birthCertificate'), url: p.birthCertificateUrl },
        { label: t('documents.nationalId'), url: p.nationalIdUrl },
        { label: t('documents.passport'), url: p.passportUrl },
        { label: t('documents.nationality'), url: p.nationalityDocumentUrl },
    ].filter((d) => Boolean(d.url));

    return (
        <PageShell padded={false} size="wide">
            <DetailHeader
                backHref="/registrations"
                backLabel={t('backToList')}
                eyebrow={isLeader ? tCommon('leader') : tCommon('athlete')}
                eyebrowIcon={isLeader ? Shield : Trophy}
                title={nameLatin}
                description={nameKhmer}
                meta={
                    <>
                        <Badge variant={isLeader ? 'warning' : 'default'} size="sm">
                            {p.role}
                        </Badge>
                        {isLeader && p.leader_role && (
                            <Badge variant="outline" size="sm">{p.leader_role}</Badge>
                        )}
                        {p.created_at && (
                            <span className="text-xs text-muted-foreground">
                                {t('fields.registeredOn')}: {new Date(p.created_at).toLocaleDateString()}
                            </span>
                        )}
                    </>
                }
                action={
                    <Button onClick={() => setIsEditOpen(true)} className="gap-2">
                        <Pencil className="h-4 w-4" />
                        {tCommon('edit')}
                    </Button>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Photo */}
                <ContentPanel className="flex flex-col items-center gap-4 lg:col-span-1">
                    <div className="relative h-40 w-40 overflow-hidden rounded-full border border-primary/20 bg-primary/10">
                        {(p.photo_url || p.photoUrl) ? (
                            <Image
                                src={(p.photo_url || p.photoUrl) as string}
                                alt={nameLatin}
                                fill
                                sizes="160px"
                                unoptimized
                                className="object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <User className="h-16 w-16 text-primary" />
                            </div>
                        )}
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-foreground">{nameKhmer}</p>
                        <p className="text-sm uppercase text-muted-foreground">{nameLatin}</p>
                    </div>
                </ContentPanel>

                {/* Personal information */}
                <ContentPanel className="lg:col-span-2">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        <BadgeCheck className="h-4 w-4" /> {t('sections.personal')}
                    </h2>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <Field icon={User} label={t('fields.gender')} value={p.gender || dash} />
                        <Field icon={Calendar} label={t('fields.dateOfBirth')} value={p.date_of_birth || dash} />
                        <div className="space-y-1">
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Phone className="h-3.5 w-3.5" /> {t('fields.phone')}
                            </dt>
                            <dd className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <span className="font-mono">
                                    {p.phone ? (phoneShown ? p.phone : maskPhone(p.phone)) : dash}
                                </span>
                                {p.phone && (
                                    <button
                                        type="button"
                                        onClick={() => setPhoneShown((s) => !s)}
                                        className="text-muted-foreground transition-colors hover:text-primary"
                                        aria-label={phoneShown ? t('phone.hide') : t('phone.show')}
                                    >
                                        {phoneShown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                )}
                            </dd>
                        </div>
                        <Field icon={Shield} label={t('fields.role')} value={p.role || dash} />
                    </dl>
                </ContentPanel>

                {/* Participation */}
                <ContentPanel className="lg:col-span-3">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        <Trophy className="h-4 w-4" /> {t('sections.participation')}
                    </h2>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Field icon={Calendar} label={t('fields.event')} value={p.event_name || dash} />
                        <Field icon={Trophy} label={t('fields.sport')} value={p.sport?.name || p.sport_name || dash} />
                        {isLeader ? (
                            <Field icon={Shield} label={t('fields.leaderRole')} value={p.leader_role || dash} />
                        ) : (
                            <Field icon={BadgeCheck} label={t('fields.category')} value={p.category?.name || dash} />
                        )}
                        <Field icon={Building2} label={t('fields.organization')} value={p.organization?.name || dash} />
                    </dl>
                </ContentPanel>

                {/* Documents */}
                <ContentPanel className="lg:col-span-3">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        <FileText className="h-4 w-4" /> {t('sections.documents')}
                    </h2>
                    {documents.length === 0 ? (
                        <p className="text-sm italic text-muted-foreground">{t('documents.none')}</p>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {documents.map((doc) => (
                                <a
                                    key={doc.label}
                                    href={doc.url as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                                >
                                    <FileText className="h-4 w-4" />
                                    {doc.label}
                                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                                </a>
                            ))}
                        </div>
                    )}
                </ContentPanel>
            </div>

            <ParticipantEditForm
                participant={p}
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
            />
        </PageShell>
    );
}

function Field({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof User;
    label: string;
    value: string;
}) {
    return (
        <div className="space-y-1">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {label}
            </dt>
            <dd className="text-sm font-medium text-foreground">{value}</dd>
        </div>
    );
}
