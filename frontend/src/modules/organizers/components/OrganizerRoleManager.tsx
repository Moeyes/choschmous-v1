'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/shared';
import { useOrganizerRoles, useCreateOrganizerRole, useUpdateOrganizerRole } from '../hooks/useOrganizerRoles';

export function OrganizerRoleManager() {
    const t = useTranslations('organizer');
    const { data: roles = [], isLoading } = useOrganizerRoles(false);
    const createMutation = useCreateOrganizerRole();
    const updateMutation = useUpdateOrganizerRole();

    const [showForm, setShowForm] = useState(false);
    const [nameKh, setNameKh] = useState('');
    const [nameEn, setNameEn] = useState('');

    const handleCreate = async () => {
        if (!nameKh.trim() || !nameEn.trim()) return;
        await createMutation.mutateAsync({ name_kh: nameKh, name_en: nameEn });
        setNameKh('');
        setNameEn('');
        setShowForm(false);
    };

    const handleToggleActive = async (id: number, current: boolean) => {
        await updateMutation.mutateAsync({ id, active: !current });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('manageRoles')}</CardTitle>
                <Button size="sm" onClick={() => setShowForm(!showForm)}>
                    <Plus className="mr-1 size-3.5" />
                    {t('addRole')}
                </Button>
            </CardHeader>
            <CardContent>
                {showForm && (
                    <div className="mb-6 flex items-end gap-3 rounded-lg border border-border bg-muted/30 p-4">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Khmer</label>
                            <Input value={nameKh} onChange={(e) => setNameKh(e.target.value)} placeholder="ឈ្មោះតួនាទី" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">English</label>
                            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Role name" />
                        </div>
                        <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                            <X className="size-4" />
                        </Button>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                                <th className="pb-2 font-medium">Khmer</th>
                                <th className="pb-2 font-medium">English</th>
                                <th className="pb-2 font-medium">{t('status')}</th>
                                <th className="pb-2 font-medium">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map((role) => (
                                <tr key={role.id} className="border-b border-border last:border-0">
                                    <td className="py-3">{role.name_kh}</td>
                                    <td className="py-3">{role.name_en}</td>
                                    <td className="py-3">
                                        <Badge variant={role.active ? 'success' : 'secondary'} size="sm">
                                            {role.active ? t('active') : t('inactive')}
                                        </Badge>
                                    </td>
                                    <td className="py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleActive(role.id, role.active)}
                                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                                role.active
                                                    ? 'bg-success/10 text-success hover:bg-success/20'
                                                    : 'bg-muted text-muted-foreground hover:bg-border'
                                            }`}
                                        >
                                            {role.active ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
                                            {role.active ? t('active') : t('inactive')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {roles.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                        {t('noRoles')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
