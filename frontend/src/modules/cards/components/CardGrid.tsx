'use client';

import React, { useState, useMemo } from 'react';
import { useAuth, usePermissions, CAPABILITIES } from '@/core/auth';
import { useEvents } from '@/modules/events';
import { useOrganizations } from '@/modules/organizations';
import { useCards } from '../hooks/useCards';
import CardIframe from './CardIframe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { CardData } from '../types';
import CardViewModal from './CardViewModal';
import { useTranslations } from 'next-intl';

export const CardGrid: React.FC = () => {
    const { user } = useAuth();
    const { can } = usePermissions();
    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);
    const t = useTranslations('cards');
    const tCommon = useTranslations('common');

    const { data: events } = useEvents();
    const { data: orgs } = useOrganizations();

    const [selectedEventId, setSelectedEventId] = useState('');
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

    const eventId = useMemo(() => {
        if (selectedEventId) return selectedEventId;
        if (events && events.length > 0) return String(events[0].id);
        return '';
    }, [selectedEventId, events]);

    const orgId = useMemo(() => {
        if (isAdmin) return selectedOrgId;
        if (user?.org_id) return String(user.org_id);
        return '';
    }, [isAdmin, selectedOrgId, user]);

    // Selects capture the id; the triggers must display the name (Base UI shows the raw value otherwise).
    const selectedEventName = events?.find(e => String(e.id) === eventId)?.name;
    const selectedOrgName = orgs?.find(o => String(o.id) === orgId)?.name_kh;

    const { cards, total, isLoading } = useCards(orgId, eventId, page);

    const filteredCards = useMemo(() => {
        if (!searchTerm) return cards;
        return cards.filter(card => card.participantName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [cards, searchTerm]);

    const totalPages = Math.ceil(total / 12);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 md:items-end justify-between bg-card p-4 rounded-lg shadow-sm border border-border">
                <div className="flex flex-col md:flex-row gap-4 flex-1">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">{t('event')}</label>
                        <Select value={eventId} onValueChange={(val) => setSelectedEventId(val || '')}>
                            <SelectTrigger className="w-full md:w-50"><SelectValue placeholder={t('selectEvent')}>{selectedEventName}</SelectValue></SelectTrigger>
                            <SelectContent>
                                {events?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {isAdmin && (
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{t('organization')}</label>
                            <Select value={orgId} onValueChange={(val) => setSelectedOrgId(val || '')}>
                                <SelectTrigger className="w-full md:w-50"><SelectValue placeholder={t('selectOrganization')}>{selectedOrgName}</SelectValue></SelectTrigger>
                                <SelectContent>
                                    {orgs?.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name_kh}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-1 flex-1">
                        <label className="text-xs font-medium text-muted-foreground">{t('search')}</label>
                        <Input placeholder={t('searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:max-w-75" />
                    </div>
                </div>
                <Button variant="outline" className="w-full text-xs md:w-auto" disabled>{tCommon('exportAll')}</Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {[...Array(10)].map((_, i) => <div key={i} className="bg-muted animate-pulse h-55 rounded-lg" />)}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredCards.map((card) => (
                            <div key={card.pId} className="flex flex-col border rounded-lg overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow">
                                <div className="bg-muted/40 p-2 flex justify-center">
                                    <CardIframe {...card} scale={0.45} />
                                </div>
                                <div className="p-2 space-y-2 border-t">
                                    <div className="text-[12px] font-medium truncate text-foreground" title={card.participantName}>{card.participantName}</div>
                                    <div className="flex gap-1">
                                        <Button size="sm" className="flex-1 text-[11px] h-7 px-2" onClick={() => setSelectedCard(card)}>{tCommon('view')}</Button>
                                        <Button size="sm" variant="outline" className="flex-1 text-[11px] h-7 px-2" disabled>{tCommon('pdf')}</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredCards.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">{t('noCardsFound')}</div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{tCommon('previous')}</Button>
                            <span className="text-sm text-muted-foreground">{t('page', { page, total: totalPages })}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>{tCommon('next')}</Button>
                        </div>
                    )}
                </>
            )}

            {selectedCard && <CardViewModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
        </div>
    );
};

export default CardGrid;
