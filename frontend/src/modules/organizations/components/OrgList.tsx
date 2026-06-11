'use client';

import { useMemo, useState } from 'react';
import { InstituteType } from '../types';
import type { OrganizationPublic } from '../schema/organizations.schema';
import { useOrganizations, useDeleteOrganization } from '../hooks';
import { useOrganizationsFiltersStore } from '../store/organizationsFilters.store';
import { OrgForm } from './OrgForm';
import { Modal, Badge, ListPage, useConfirm } from '@/shared';
import { Button } from '@/shared/ui/button';
import { usePermissions, CAPABILITIES } from '@/core/auth';
import { Edit2, Trash2, Plus, Building2, Landmark, GraduationCap, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function OrgList() {
    const getQueryParams = useOrganizationsFiltersStore((s) => s.getQueryParams);
    const params = useMemo(() => getQueryParams(), [getQueryParams]);

    const { data: orgs, isLoading, error } = useOrganizations(params);
    const { mutate: deleteOrg } = useDeleteOrganization();
    const { can } = usePermissions();
    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);
    const t = useTranslations('organizations');
    const tCommon = useTranslations('common');
    const confirm = useConfirm();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<OrganizationPublic | undefined>(undefined);

    const handleCreate = () => { setEditingOrg(undefined); setIsModalOpen(true); };
    const handleEdit = (org: OrganizationPublic) => { setEditingOrg(org); setIsModalOpen(true); };
    const handleDelete = async (orgId: number) => { if (await confirm({ message: t('deleteConfirm') })) deleteOrg(orgId); };
    const closeModal = () => { setIsModalOpen(false); setEditingOrg(undefined); };

    return (
        <div className="space-y-6">
            <ListPage
                title={t('title')}
                description={t('description')}
                icon={Building2}
                action={isAdmin && <Button onClick={handleCreate} className="h-11 gap-2 px-6"><Plus className="w-4 h-4" />{t('createOrganization')}</Button>}
                error={error}
                errorTitle={t('failedToLoad')}
                isLoading={isLoading}
                data={orgs || []}
                columns={[
                    {
                        header: t('columns.orgName'),
                        accessor: (org) => (
                            <div className="flex flex-col">
                                <span className="font-black text-foreground">{org.name_kh}</span>
                                {org.name_en && <span className="text-[10px] text-muted-foreground uppercase font-bold">{org.name_en}</span>}
                            </div>
                        ),
                    },
                    { header: t('columns.type'), accessor: (org) => <TypeBadge type={org.type} /> },
                    ...(isAdmin ? [{
                        header: tCommon('actions'), align: 'right' as const,
                        accessor: (org: OrganizationPublic) => (
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(org)}><Edit2 className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(org.id)} className="text-error hover:text-error hover:bg-error/5"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        ),
                    }] : []),
                ]}
            />
            {isAdmin && (
                <Modal isOpen={isModalOpen} onClose={closeModal} title={editingOrg ? t('editOrganization') : t('createNewOrganization')}>
                    <OrgForm org={editingOrg} onSuccess={closeModal} onCancel={closeModal} />
                </Modal>
            )}
        </div>
    );
}

function TypeBadge({ type }: { type: InstituteType }) {
    const t = useTranslations('organizations.types');
    const config = {
        [InstituteType.PROVINCE]:    { variant: 'default' as const, icon: Building2 },
        [InstituteType.MINISTRY]:    { variant: 'info' as const, icon: Landmark },
        [InstituteType.FEDERATION]:  { variant: 'success' as const, icon: Shield },
        [InstituteType.UNIVERSITY]:  { variant: 'warning' as const, icon: GraduationCap },
    };
    const { variant, icon: Icon } = config[type] || { variant: 'secondary' as const, icon: Building2 };
    return <Badge variant={variant} className="gap-1.5"><Icon className="w-3 h-3" />{t(type)}</Badge>;
}
