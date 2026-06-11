'use client';

import { useState } from 'react';
import { useEventSports, useAddSportToEvent, useRemoveSportFromEvent, useAllSports } from '../hooks';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useAuth, UserRole } from '@/core/auth';
import { Plus, Trash2, Trophy, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EventSportManagerProps {
    eventId: number;
    onSelectSport: (sportId: number) => void;
    selectedSportId: number | null;
}

export function EventSportManager({ eventId, onSelectSport, selectedSportId }: EventSportManagerProps) {
    const { data: eventSports, isLoading } = useEventSports(eventId);
    const { data: allSports } = useAllSports();
    const { mutate: addSport, isPending: adding } = useAddSportToEvent();
    const { mutate: removeSport } = useRemoveSportFromEvent();
    const { hasRole } = useAuth();
    // Assigning sports to an event is an administrator capability — both
    // admin and super_admin (super_admin can access every feature).
    const canManage = hasRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    const t = useTranslations('events.sports');
    const tCommon = useTranslations('common');

    const [newSportId, setNewSportId] = useState('');

    const handleAdd = () => {
        if (!newSportId) return;
        addSport({ event_id: eventId, sport_id: Number(newSportId) }, { onSuccess: () => setNewSportId('') });
    };

    const handleRemove = (sportId: number) => {
        if (window.confirm(t('removeSportConfirm'))) removeSport({ eventId, associationId: sportId });
    };

    const availableSports = allSports?.filter(s => !eventSports?.some(es => es.sports_id === s.id)) || [];
    // The Select captures the sport id as its value, but the trigger must show
    // the human-readable name — Base UI renders the raw value otherwise.
    const selectedSportName = availableSports.find(s => s.id.toString() === newSportId)?.name_kh;

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" />{t('title')}</h3>
                {canManage && (
                    <div className="flex items-center gap-2">
                        <Select value={newSportId} onValueChange={(val) => setNewSportId(val || '')}>
                            <SelectTrigger className="w-50"><SelectValue placeholder={t('selectSport')}>{selectedSportName}</SelectValue></SelectTrigger>
                            <SelectContent>
                                {availableSports.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name_kh}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleAdd} disabled={!newSportId || adding} size="sm">
                            <Plus className="w-4 h-4 mr-2" />{tCommon('add')}
                        </Button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {eventSports?.map((sport) => (
                    <div key={sport.id} onClick={() => onSelectSport(sport.sports_id)}
                        className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${selectedSportId === sport.sports_id ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/50'}`}>
                        <span className="font-medium">{sport.name_kh}</span>
                        {canManage && (
                            <button onClick={(e) => { e.stopPropagation(); handleRemove(sport.id); }} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                {eventSports?.length === 0 && <p className="text-muted-foreground text-sm col-span-full text-center py-8">{t('noSportsAssigned')}</p>}
            </div>
        </div>
    );
}
