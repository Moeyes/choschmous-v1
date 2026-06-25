'use client';

import { useMemo, useState } from 'react';
import { Eye, PersonStanding, UserCheck, UsersRound, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Modal, Badge, DataTable } from '@/shared';
import { ToggleGroup } from '@/shared/ui/toggle-group';
import { usePermissions, CAPABILITIES } from '@/core/auth';
import { useRegistrations, useRevealParticipantPhone } from '@/modules/registration';

interface RosterRow {
    id: number;
    kh_family_name: string;
    kh_given_name: string;
    en_family_name: string;
    en_given_name: string;
    sport_name?: string | null;
    event_name?: string | null;
    role: string;
    leader_role?: string | null;
}

export interface OrgRosterTarget {
    eventId: number;
    sportId: number;
    sportName: string;
    eventName: string;
}

interface OrgRosterModalProps {
    orgId: number;
    target: OrgRosterTarget;
    onClose: () => void;
}

/**
 * Phone is Restricted-PII and is never sent with the list (data minimization).
 * Admins fetch it on demand through the audited reveal endpoint; everyone else
 * sees nothing. Each row owns its own reveal state so one reveal never exposes
 * another participant's number.
 */
function RevealablePhone({ enrollId }: { enrollId: number }) {
    const t = useTranslations('organizations.detail');
    const { can } = usePermissions();
    const reveal = useRevealParticipantPhone();

    if (!can(CAPABILITIES.REVEAL_PII)) return <span className="text-muted-foreground">—</span>;
    if (reveal.data) return <span className="text-xs text-muted-foreground">{reveal.data.phone}</span>;

    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); reveal.mutate(enrollId); }}
            disabled={reveal.isPending}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
        >
            <Eye className="h-3 w-3" />
            {reveal.isPending ? t('revealing') : t('revealPhone')}
        </button>
    );
}

export function OrgRosterModal({ orgId, target, onClose }: OrgRosterModalProps) {
    const t = useTranslations('organizations.detail');
    const tCommon = useTranslations('common');
    const [role, setRole] = useState<'all' | 'athlete' | 'leader'>('all');

    const { data, isLoading } = useRegistrations({
        organization_id: orgId,
        event_id: target.eventId,
        sport_id: target.sportId,
        limit: 500,
    });

    const allRows = useMemo(() => (data?.data ?? []) as unknown as RosterRow[], [data]);
    const counts = useMemo(() => ({
        all: allRows.length,
        athlete: allRows.filter((r) => r.role === 'athlete').length,
        leader: allRows.filter((r) => r.role === 'leader').length,
    }), [allRows]);
    const rows = role === 'all' ? allRows : allRows.filter((r) => r.role === role);

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="xl"
            title={target.sportName}
            description={`${target.eventName} · ${t('nRegistered', { count: counts.all })}`}
        >
            <div className="mb-4">
                <ToggleGroup
                    value={role}
                    onChange={(v) => setRole(v as 'all' | 'athlete' | 'leader')}
                    options={[
                        { value: 'all', label: `${tCommon('all')} · ${counts.all}`, icon: Users },
                        { value: 'athlete', label: `${tCommon('athlete')} · ${counts.athlete}`, icon: PersonStanding },
                        { value: 'leader', label: `${tCommon('leader')} · ${counts.leader}`, icon: UserCheck },
                    ]}
                />
            </div>
            <DataTable
                data={rows}
                isLoading={isLoading}
                rowKey={(r) => `${r.role}-${r.id}`}
                minWidth="min-w-[560px]"
                emptyState={
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <UsersRound className="h-6 w-6 text-muted-foreground" />
                        </span>
                        <p className="text-sm text-muted-foreground">{t('noParticipants')}</p>
                    </div>
                }
                columns={[
                    {
                        header: t('columns.participant'),
                        accessor: (r: RosterRow) => {
                            const RoleIcon = r.role === 'athlete' ? PersonStanding : UserCheck;
                            return (
                                <div className="flex items-center gap-2.5">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
                                        <RoleIcon className="h-4 w-4" />
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-foreground">
                                            {`${r.kh_family_name} ${r.kh_given_name}`.trim() || `${r.en_family_name} ${r.en_given_name}`.trim()}
                                        </span>
                                        <RevealablePhone enrollId={r.id} />
                                    </div>
                                </div>
                            );
                        },
                    },
                    {
                        header: t('columns.type'),
                        accessor: (r: RosterRow) => (
                            <Badge variant={r.role === 'athlete' ? 'info' : 'secondary'}>
                                {r.role === 'athlete' ? tCommon('athlete') : tCommon('leader')}
                            </Badge>
                        ),
                    },
                    {
                        header: t('columns.role'),
                        hideOnMobile: true,
                        accessor: (r: RosterRow) =>
                            r.role === 'athlete'
                                ? <span className="text-sm text-muted-foreground">—</span>
                                : <span className="text-sm text-muted-foreground">{r.leader_role?.replace(/_/g, ' ') || '—'}</span>,
                    },
                ]}
            />
        </Modal>
    );
}
