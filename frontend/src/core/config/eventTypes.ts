/**
 * Event-type domain catalog.
 *
 * Shared by the "By Sport" (survey) and "By Number" registration wizards.
 * These four categories are a fixed MoEYS domain enum; the Khmer label is the
 * official name shown in the event-type picker. Kept in one place so the two
 * wizards cannot drift out of sync.
 */
export const EVENT_TYPES = [
    { id: 'NATIONAL', name_kh: 'កីឡាជាតិ' },
    { id: 'UNIVERSITY', name_kh: 'កីឡាឧត្តមសិក្សា និងមធ្យមសិក្សា​បចេ្ចកទេសថ្នាក់ជាតិថ្នាក់ជាតិ' },
    { id: 'HIGH_SCHOOL', name_kh: 'សិស្សមធ្យមសិក្សា​ថ្នាក់ជាតិ' },
    { id: 'PRIMARY_SCHOOL', name_kh: 'កីឡាសិស្សបឋមសិក្សាជាតិ' },
];

export const EVENT_TYPE_ICONS: Record<string, string> = {
    NATIONAL: 'Trophy',
    UNIVERSITY: 'GraduationCap',
    HIGH_SCHOOL: 'GraduationCap',
    PRIMARY_SCHOOL: 'Baby',
};
