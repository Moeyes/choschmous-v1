/**
 * IUsersRepository
 *
 * Declares what the users module needs from the data layer — not how it is
 * fetched. Hooks depend only on this interface; swapping HTTP ↔ mock adapter
 * requires changing exactly one line in adapters/index.ts.
 */
import type { UserPublic, UsersPublic } from '../schema/users.schema';
import type { UserCreate, UserUpdate } from '../types';

export interface UserListParams {
    skip?:      number;
    limit?:     number;
    role?:      string;
    is_active?: boolean;
    username?:  string;
}

export interface IUsersRepository {
    getAll(params?: UserListParams): Promise<UsersPublic>;
    getById(id: string): Promise<UserPublic>;
    create(dto: UserCreate): Promise<UserPublic>;
    update(dto: UserUpdate): Promise<UserPublic>;
    delete(id: string): Promise<void>;
}
