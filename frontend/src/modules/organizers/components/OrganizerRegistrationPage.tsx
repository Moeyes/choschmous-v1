'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, ClipboardCheck, ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { Card, CardContent, Button, Badge, StepIndicator } from '@/shared';
import { useAuth, UserRole } from '@/core/auth';
import { useCascadingData } from '@/modules/registration/hooks';
import { useOrganizerRoles } from '../hooks/useOrganizerRoles';
import { useOrganizerRegistration } from '../hooks/useOrganizerRegistration';

type Step = 'event' | 'personal' | 'role' | 'review';

type CascadeEvent = { id: number | string; name_en?: string | null; name_kh?: string | null; registration_is_open?: boolean };
type CascadeOrg = { id: number | string; name_en?: string | null; name_kh?: string | null };

const fieldCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-body placeholder:text-muted-text focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all';
const labelCls = 'block text-sm font-medium text-foreground mb-1';

export function OrganizerRegistrationPage() {
    const t = useTranslations('registration');
    const tCommon = useTranslations('common');
    const tOrg = useTranslations('organizer');
    const { user } = useAuth();
    const { data: cascadingData, isLoading: cascadingLoading } = useCascadingData();
    const { data: roles = [] } = useOrganizerRoles(true);
    const registerMutation = useOrganizerRegistration();

    const [step, setStep] = useState<Step>('event');
    const [success, setSuccess] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const [eventId, setEventId] = useState('');
    const [orgId, setOrgId] = useState<string | undefined>(
        user?.role === UserRole.ORGANIZATION && user?.org_id ? String(user.org_id) : undefined,
    );
    const [khFamilyName, setKhFamilyName] = useState('');
    const [khGivenName, setKhGivenName] = useState('');
    const [enFamilyName, setEnFamilyName] = useState('');
    const [enGivenName, setEnGivenName] = useState('');
    const [gender, setGender] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [phone, setPhone] = useState('');
    const [idDocType, setIdDocType] = useState('IDCard');
    const [address, setAddress] = useState('');
    const [organizerRoleId, setOrganizerRoleId] = useState('');

    const steps: Step[] = ['event', 'personal', 'role', 'review'];
    const stepIndex = steps.indexOf(step);

    const events = useMemo(() => {
        if (!cascadingData?.events) return [];
        return (cascadingData.events as CascadeEvent[]).filter((e) => e.registration_is_open !== false);
    }, [cascadingData]);

    const selectedEvent = events.find((e) => String(e.id) === eventId);

    const handleNext = () => {
        const idx = steps.indexOf(step);
        if (idx < steps.length - 1) setStep(steps[idx + 1]);
    };

    const handleBack = () => {
        const idx = steps.indexOf(step);
        if (idx > 0) setStep(steps[idx - 1]);
    };

    const canProceedEvent = !!eventId;
    const canProceedPersonal = khFamilyName && khGivenName && enFamilyName && enGivenName && gender && dateOfBirth && phone;
    const canProceedRole = !!organizerRoleId;

    const handleSubmit = async () => {
        setServerError(null);
        try {
            await registerMutation.mutateAsync({
                eventId: Number(eventId),
                organizationId: orgId ? Number(orgId) : null,
                organizerRoleId: Number(organizerRoleId),
                lastNameKhmer: khFamilyName,
                firstNameKhmer: khGivenName,
                lastNameLatin: enFamilyName,
                firstNameLatin: enGivenName,
                gender,
                dateOfBirth,
                phone,
                idDocType,
                nationality: 'Cambodian',
                address: address || null,
            });
            setSuccess(true);
        } catch (err) {
            const detail = (err as { response?: { data?: { detail?: string | { message?: string } } } })?.response?.data?.detail;
            if (typeof detail === 'string') setServerError(detail);
            else if (detail?.message) setServerError(detail.message);
            else setServerError(tCommon('toast.error'));
        }
    };

    if (cascadingLoading) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-8">
                <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-20 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="size-6 animate-spin" />
                    {t('loadingForm')}
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-8">
                <Card>
                    <CardContent className="py-12 text-center">
                        <ClipboardCheck className="mx-auto size-12 text-success" />
                        <h2 className="mt-4 text-xl font-bold">{tOrg('registerSuccess')}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{tOrg('registerSuccessDesc')}</p>
                        <Button className="mt-6" onClick={() => window.location.reload()}>
                            {tOrg('registerAnother')}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const stepLabels = steps.map((s) => tOrg(`step.${s}`));

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            <div className="text-center">
                <Badge variant="primary" size="sm" className="mb-4 inline-flex gap-1.5">
                    <ClipboardCheck className="size-3.5" />
                    {tOrg('title')}
                </Badge>
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{tOrg('title')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{tOrg('subtitle')}</p>
            </div>

            <StepIndicator steps={stepLabels} currentIndex={stepIndex} onStepClick={() => {}} />

            {serverError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {serverError}
                </div>
            )}

            <Card>
                <CardContent className="space-y-4 py-6">
                    {step === 'event' && (
                        <>
                            <h3 className="text-lg font-semibold">{tOrg('step.event')}</h3>
                            <div>
                                <label className={labelCls}>{tOrg('selectEvent')}</label>
                                <select
                                    value={eventId}
                                    onChange={(e) => setEventId(e.target.value)}
                                    className={fieldCls}
                                >
                                    <option value="">{tOrg('selectEvent')}</option>
                                    {events.map((e) => (
                                        <option key={e.id} value={String(e.id)}>
                                            {e.name_en || e.name_kh || `Event #${e.id}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {user?.role !== UserRole.ORGANIZATION && (
                                <div>
                                    <label className={labelCls}>{tOrg('selectOrg')}</label>
                                    <select
                                        value={orgId ?? ''}
                                        onChange={(e) => setOrgId(e.target.value || undefined)}
                                        className={fieldCls}
                                    >
                                        <option value="">{tOrg('selectOrg')}</option>
                                        {((cascadingData?.organizations ?? []) as CascadeOrg[]).map((o) => (
                                            <option key={o.id} value={String(o.id)}>
                                                {o.name_en || o.name_kh || `Org #${o.id}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    {step === 'personal' && (
                        <>
                            <h3 className="text-lg font-semibold">{tOrg('step.personal')}</h3>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>{t('fields.khFamilyName')}</label>
                                    <input className={fieldCls} value={khFamilyName} onChange={(e) => setKhFamilyName(e.target.value)} placeholder={t('fields.khFamilyName')} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('fields.khGivenName')}</label>
                                    <input className={fieldCls} value={khGivenName} onChange={(e) => setKhGivenName(e.target.value)} placeholder={t('fields.khGivenName')} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('fields.enFamilyName')}</label>
                                    <input className={fieldCls} value={enFamilyName} onChange={(e) => setEnFamilyName(e.target.value)} placeholder={t('fields.enFamilyName')} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('fields.enGivenName')}</label>
                                    <input className={fieldCls} value={enGivenName} onChange={(e) => setEnGivenName(e.target.value)} placeholder={t('fields.enGivenName')} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('fields.gender')}</label>
                                    <select value={gender} onChange={(e) => setGender(e.target.value)} className={fieldCls}>
                                        <option value="">{t('fields.gender')}</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>{t('fields.dateOfBirth')}</label>
                                    <input type="date" className={fieldCls} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('fields.phone')}</label>
                                    <input className={fieldCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('fields.phone')} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('fields.idType')}</label>
                                    <select value={idDocType} onChange={(e) => setIdDocType(e.target.value)} className={fieldCls}>
                                        <option value="IDCard">ID Card</option>
                                        <option value="Passport">Passport</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>{t('fields.address')}</label>
                                <input className={fieldCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('fields.addressPlaceholder')} />
                            </div>
                        </>
                    )}

                    {step === 'role' && (
                        <>
                            <h3 className="text-lg font-semibold">{tOrg('step.role')}</h3>
                            <div className="space-y-2">
                                {roles.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{tOrg('noRoles')}</p>
                                ) : (
                                    roles.map((role) => (
                                        <button
                                            key={role.id}
                                            type="button"
                                            onClick={() => setOrganizerRoleId(String(role.id))}
                                            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                                                organizerRoleId === String(role.id)
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-primary/50'
                                            }`}
                                        >
                                            <span className="font-medium">{role.name_en}</span>
                                            <span className="ml-2 text-xs text-muted-foreground">{role.name_kh}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {step === 'review' && (
                        <>
                            <h3 className="text-lg font-semibold">{tOrg('step.review')}</h3>
                            <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-muted-foreground">{tOrg('event')}:</span> {selectedEvent?.name_en || selectedEvent?.name_kh || eventId}</div>
                                    <div><span className="text-muted-foreground">{tOrg('organizerRole')}:</span> {roles.find((r) => String(r.id) === organizerRoleId)?.name_en}</div>
                                    <div><span className="text-muted-foreground">{t('fields.khFamilyName')}:</span> {khFamilyName}</div>
                                    <div><span className="text-muted-foreground">{t('fields.khGivenName')}:</span> {khGivenName}</div>
                                    <div><span className="text-muted-foreground">{t('fields.enFamilyName')}:</span> {enFamilyName}</div>
                                    <div><span className="text-muted-foreground">{t('fields.enGivenName')}:</span> {enGivenName}</div>
                                    <div><span className="text-muted-foreground">{t('fields.dateOfBirth')}:</span> {dateOfBirth}</div>
                                    <div><span className="text-muted-foreground">{t('fields.phone')}:</span> {phone}</div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-4">
                <Button variant="outline" size="lg" onClick={handleBack} disabled={stepIndex === 0}>
                    <ArrowLeft className="size-4" />
                    {tCommon('back')}
                </Button>
                {step === 'review' ? (
                    <Button
                        variant="default"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={registerMutation.isPending}
                        className="bg-success hover:bg-success/90"
                    >
                        {registerMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Send className="size-4" />
                        )}
                        {registerMutation.isPending ? t('submitting') : t('submit')}
                    </Button>
                ) : (
                    <Button
                        variant="default"
                        size="lg"
                        onClick={handleNext}
                        disabled={
                            (step === 'event' && !canProceedEvent) ||
                            (step === 'personal' && !canProceedPersonal) ||
                            (step === 'role' && !canProceedRole)
                        }
                    >
                        {tCommon('next')}
                        <ArrowRight className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
