import type { User } from '@/core/auth';
import { UserRole } from '@/core/auth';

/**
 * User Management Types
 */

export interface UserCreate {
  email: string;
  username: string;
  password?: string;
  role: UserRole;
  organization_id?: number | null;
  sport_id?: number | null;
  kh_family_name: string;
  kh_given_name: string;
  en_family_name: string;
  en_given_name: string;
}

export interface UserUpdate extends Partial<UserCreate> {
  id: string;
  is_active?: boolean;
}

interface UserListResponse {
  users: User[];
  total: number;
}
