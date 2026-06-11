/**
 * Application Constants
 * 
 * Global constants used throughout the application
 */

import { UserRole } from '@/core/auth/types';

export { routes } from './routes';

/**
 * Role-based default redirect after login
 */
export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: '/dashboard',
    [UserRole.ADMIN]: '/dashboard',
    [UserRole.ORGANIZATION]: '/dashboard',
    [UserRole.FEDERATION]: '/by-category',
    [UserRole.GUEST]: '/register',
};

export const GENDER_OPTIONS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
];

export const LEADER_ROLE_OPTIONS = [
    { value: 'coach', label: 'Coach' },
    { value: 'manager', label: 'Manager' },
    { value: 'delegate', label: 'Delegate' },
    { value: 'team_lead', label: 'Team Lead' },
    { value: 'coach_trainer', label: 'Coach Trainer' },
    { value: 'teacher_assistant', label: 'Teacher Assistant' },
] as const;
