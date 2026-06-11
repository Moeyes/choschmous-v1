'use client';

import { useState } from 'react';
import { useEventSportOrgs, useAddOrgToEventSport, useDeleteEventSportOrgLink, useAllOrganizations } from '../hooks';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useAuth, UserRole } from '@/core/auth';
import { Plus, Trash2, Building2, Loader2, Search } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import type { OrganizationReference as Organization } from '@/core/api/referenceData';
import { useTranslations } from 'next-intl';

interface EventSportOrgManagerProps { eventId: number; sportId: number; sportName: string; }

export function EventSportOrgManager({ eventId, sportId, sportName }: EventSportOrgManagerProps) {
    const { data: sportOrgs, isLoading } = useEventSportOrgs(eventId, sportId);
    const { data: allOrgs } = useAllOrganizations();
    const { mutate: addOrg, isPending: adding } = useAddOrgToEventSport();
    const { mutate: deleteLink } = useDeleteEventSportOrgLink();
    const { hasRole } = useAuth();
    // Managing event-sport organizations is an admin + super_admin capability.
    const isAdmin = hasRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    const t = useTranslations('events.orgs');
    const tCommon = useTranslations('common');

    const [newOrgId, setNewOrgId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const handleAdd = () => {
        if (!newOrgId) return;
        addOrg({ event_id: eventId, sport_id: sportId, org_id: Number(newOrgId) }, { onSuccess: () => setNewOrgId(''), onError: () => setNewOrgId('') });
    };

    const handleRemove = (org: Organization & { _linkId?: number }) => {
        if (window.confirm(t('removeOrgConfirm')))
            deleteLink({ association_id: org._linkId ?? org.id, event_id: eventId, sport_id: sportId });
    };

    const filteredAvailableOrgs = allOrgs?.filter(o => {
        const isNotAdded = !sportOrgs?.some(so => so.id === o.id);
        const matchesSearch = o.name_kh.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.code?.toLowerCase().includes(searchTerm.toLowerCase());
        return isNotAdded && matchesSearch;
    }).slice(0, 50) || [];

    // Trigger must show the org name, not the captured id (Base UI renders the raw value otherwise).
    const selectedOrgName = allOrgs?.find(o => o.id.toString() === newOrgId)?.name_kh;

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />{t('title', { sportName })}</h3>
                    <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                </div>
                {isAdmin && (
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                            <div className="relative w-full sm:w-75">
                                <Select value={newOrgId} onValueChange={(val) => setNewOrgId(val || '')}>
                                    <SelectTrigger><SelectValue placeholder={t('selectOrg')}>{selectedOrgName}</SelectValue></SelectTrigger>
                                    <SelectContent>
                                        <div className="px-2 py-2 border-b">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder={t('search')} className="pl-8 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                            </div>
                                        </div>
                                        {filteredAvailableOrgs.map(o => <SelectItem key={o.id} value={o.id.toString()}>{o.name_kh} {o.code ? `(${o.code})` : ''}</SelectItem>)}
                                        {filteredAvailableOrgs.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">{t('noMatches')}</div>}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAdd} disabled={!newOrgId || adding} size="sm">
                                <Plus className="w-4 h-4 mr-2" />{tCommon('add')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            <div className="bg-card rounded-lg border border-border overflow-x-auto">
                <table className="w-full min-w-[480px] text-left border-collapse">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border">
                            <th className="p-4 font-semibold text-sm">{t('columns.orgName')}</th>
                            <th className="p-4 font-semibold text-sm">{t('columns.code')}</th>
                            <th className="p-4 font-semibold text-sm">{t('columns.type')}</th>
                            {isAdmin && <th className="p-4 font-semibold text-sm text-right">{tCommon('actions')}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sportOrgs?.map((org) => (
                            <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                                <td className="p-4 text-sm font-medium">{org.name_kh}</td>
                                <td className="p-4 text-sm text-muted-foreground">{org.code || '-'}</td>
                                <td className="p-4 text-sm text-muted-foreground">{org.type || '-'}</td>
                                {isAdmin && (
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleRemove(org as Organization & { _linkId?: number })} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {sportOrgs?.length === 0 && (
                            <tr><td colSpan={isAdmin ? 4 : 3} className="p-8 text-center text-muted-foreground text-sm">{t('noOrgsAssigned')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
