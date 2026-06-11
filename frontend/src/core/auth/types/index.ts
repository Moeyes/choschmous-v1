export enum UserRole {
    // Values MUST match the exact strings the backend returns (see
    // backend src/models/enum/user.py and the JWT `role` claim).
    SUPER_ADMIN  = 'super_admin',
    ADMIN        = 'admin',
    ORGANIZATION = 'organization',
    FEDERATION   = 'federation',
    // Frontend-only fallback; the backend has no "guest" role.
    GUEST        = 'GUEST',
}

export interface User {
    id:            string;
    username:      string;
    email:         string;
    // Backend (UserPublic) returns the four split name parts; these are the
    // source of truth. khmer_name/english_name are legacy display aliases.
    kh_family_name?: string;
    kh_given_name?:  string;
    en_family_name?: string;
    en_given_name?:  string;
    khmer_name?:    string;
    english_name?:  string;
    role:          UserRole;
    is_active:     boolean;
    is_superuser:  boolean;
    photo_path?:   string | null;
    org_id?:       number | null;
    // Backend field names (UserPublic). The session endpoint returns these
    // directly, so they are the source of truth for org/sport binding.
    organization_id?: number | null;
    sport_id?:        number | null;
    created_at:    string;
    updated_at:    string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface AuthState {
    user:            User | null;
    role:            UserRole | null;
    isAuthenticated: boolean;
    isLoading:       boolean;
    error:           string | null;
    // accessToken and refreshToken removed — now HttpOnly cookies, JS cannot access
}

export interface AuthContextType extends AuthState {
    login:      (username: string, password: string) => Promise<UserRole>;
    logout:     () => Promise<void>;
    refresh:    () => Promise<void>;
    clearError: () => void;
    hasRole:    (role: UserRole | UserRole[]) => boolean;
    canAccess:  (requiredRoles: UserRole[]) => boolean;
}

/**
 * Authoritative feature/route permission map.
 *
 * Single source of truth used by BOTH the route guards (`useRequireRole`)
 * and the sidebar visibility. SUPER_ADMIN is included in every feature, so
 * it can access every part of the app. Other roles only get the features
 * listed here — anything not listed for a role is hidden from their nav and
 * blocked at the route.
 *
 * Keys are the route segment names under app/(portal)/.
 */
export type FeatureKey =
    | 'dashboard'
    | 'events'
    | 'sports'
    | 'organizations'
    | 'bycategory'
    | 'users'
    | 'bysport'
    | 'bynumber'
    | 'register'
    | 'leaderregistration'
    | 'registrations'
    | 'participation'
    | 'reports'
    | 'cards';

const { SUPER_ADMIN, ADMIN, ORGANIZATION, FEDERATION } = UserRole;

export const FEATURE_ACCESS: Record<FeatureKey, UserRole[]> = {
    // Overview — open to every logged-in role
    dashboard:          [SUPER_ADMIN, ADMIN, ORGANIZATION, FEDERATION],
    events:             [SUPER_ADMIN, ADMIN, ORGANIZATION, FEDERATION],
    // Management — administrators only. Federation is allowed in so it can
    // browse its OWN sport's categories + participants (read-only); the
    // SportList/SportDetail components scope federation to user.sport_id and
    // hide all create/edit/delete controls.
    sports:             [SUPER_ADMIN, ADMIN, FEDERATION],
    organizations:      [SUPER_ADMIN, ADMIN],
    // User provisioning is a super-admin-only capability.
    users:              [SUPER_ADMIN],
    bycategory:         [SUPER_ADMIN, ADMIN, FEDERATION],
    // Registration — organizations register their own participants
    bysport:            [SUPER_ADMIN, ADMIN, ORGANIZATION],
    bynumber:           [SUPER_ADMIN, ADMIN, ORGANIZATION],
    register:           [SUPER_ADMIN, ADMIN, ORGANIZATION],
    leaderregistration: [SUPER_ADMIN, ADMIN, ORGANIZATION],
    // Records
    registrations:      [SUPER_ADMIN, ADMIN, ORGANIZATION],
    participation:      [SUPER_ADMIN, ADMIN, ORGANIZATION],
    reports:            [SUPER_ADMIN, ADMIN, ORGANIZATION],
    cards:              [SUPER_ADMIN, ADMIN, ORGANIZATION],
};

