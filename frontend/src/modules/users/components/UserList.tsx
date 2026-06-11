'use client';

import { useState, useCallback } from 'react';
import type { User } from '@/core/auth';
import { UserRole } from '@/core/auth';
import { useUsers } from '../hooks/useUsers';
import { useDeleteUser } from '../hooks/useMutateUsers';
import { useOrganizations } from '@/modules/organizations/hooks';
import { UserForm } from './UserForm';
import { Modal, Badge, ListPage, useConfirm } from '@/shared';
import { Button } from '@/shared/ui/button';
import { maskEmail } from '@/shared/utils/maskEmail';
import { Edit2, Trash2, UserPlus, Shield, User as UserIcon, Building2, Landmark, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UserPublic } from '../schema/users.schema';

interface UsersModalState { isFormOpen: boolean; selected: UserPublic | undefined; }
const initialModal: UsersModalState = { isFormOpen: false, selected: undefined };

export function UserList() {
    const { data: users, isLoading, error } = useUsers();
    const { data: organizations }           = useOrganizations();
    const { mutate: deleteUser }            = useDeleteUser();
    const t       = useTranslations('users');
    const tCommon = useTranslations('common');
    const confirm = useConfirm();
    const [modal, setModal] = useState<UsersModalState>(initialModal);

    const orgName = useCallback(
        (id?: number | null) => id == null ? null : organizations?.find((o) => o.id === id)?.name_kh ?? null,
        [organizations],
    );
    const handleCreate = useCallback(() => setModal({ isFormOpen: true, selected: undefined }), []);
    const handleEdit   = useCallback((user: UserPublic) => setModal({ isFormOpen: true, selected: user }), []);
    const handleDelete = useCallback(async (userId: string) => {
        if (await confirm({ message: t('deleteConfirm') })) deleteUser(userId);
    }, [confirm, deleteUser, t]);
    const closeModal   = useCallback(() => setModal(initialModal), []);

    return (
        <div className="space-y-6">
            <ListPage
                title={t('title')}
                description={t('description')}
                icon={UserIcon}
                action={<Button onClick={handleCreate} className="h-11 gap-2 px-6"><UserPlus className="w-4 h-4" />{t('createUser')}</Button>}
                error={error}
                errorTitle={t('failedToLoad')}
                isLoading={isLoading}
                data={users ?? []}
                columns={[
                    {
                        header: t('columns.user'),
                        accessor: (user) => (
                            <div className="flex flex-col">
                                <span className="font-black text-foreground">{[user.kh_family_name, user.kh_given_name].filter(Boolean).join(' ') || user.username}</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">{[user.en_family_name, user.en_given_name].filter(Boolean).join(' ') || user.username}</span>
                            </div>
                        ),
                    },
                    {
                        header: t('columns.email'),
                        accessor: (user) => (
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <Mail className="w-3.5 h-3.5 opacity-50" />
                                {maskEmail(user.email)}
                            </div>
                        ),
                    },
                    { header: t('columns.role'), accessor: (user) => <RoleBadge role={user.role as UserRole} /> },
                    {
                        header: t('columns.organization'),
                        accessor: (user) => {
                            const name = orgName(user.organization_id);
                            return (
                                <div className="text-xs font-medium text-muted-foreground">
                                    {name ? <span className="inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 opacity-50" />{name}</span> : '-'}
                                </div>
                            );
                        },
                    },
                    {
                        header: tCommon('actions'), align: 'right',
                        accessor: (user) => (
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(user)}><Edit2 className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(user.id)} className="text-error hover:text-error hover:bg-error/5"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        ),
                    },
                ]}
            />
            <Modal isOpen={modal.isFormOpen} onClose={closeModal} title={modal.selected ? t('editUser') : t('createNewUser')}>
                <UserForm user={modal.selected as unknown as User} onSuccess={closeModal} onCancel={closeModal} />
            </Modal>
        </div>
    );
}

function RoleBadge({ role }: { role: UserRole }) {
    const t = useTranslations('users.roles');
    const config = {
        [UserRole.SUPER_ADMIN]:  { label: t('superAdmin'), variant: 'default'   as const, icon: Shield    },
        [UserRole.ADMIN]:        { label: t('admin'),       variant: 'default'   as const, icon: Shield    },
        [UserRole.ORGANIZATION]: { label: t('org'),         variant: 'info'      as const, icon: Building2 },
        [UserRole.FEDERATION]:   { label: t('fed'),         variant: 'warning'   as const, icon: Landmark  },
        [UserRole.GUEST]:        { label: t('guest'),       variant: 'secondary' as const, icon: UserIcon  },
    };
    const { label, variant, icon: Icon } = config[role] ?? config[UserRole.GUEST];
    return <Badge variant={variant} className="gap-1.5"><Icon className="w-3 h-3" />{label}</Badge>;
}
