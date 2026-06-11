/**
 * usersHttpAdapter.ts
 *
 * Concrete HTTP implementation of IUsersRepository.
 * Every response is Zod-parsed with .strict() before leaving this file.
 */
import type { IUsersRepository, UserListParams } from '../ports/IUsersRepository';
import { userPublicSchema, usersPublicSchema } from '../schema/users.schema';
import { apiGetUsers, apiGetUserById, apiCreateUser, apiUpdateUser, apiDeleteUser } from '../api';
import type { UserCreate, UserUpdate } from '../types';

export const usersHttpAdapter: IUsersRepository = {
    getAll: async (params?: UserListParams) =>
        usersPublicSchema.parse(await apiGetUsers(params as Record<string, unknown>)),

    getById: async (id: string) =>
        userPublicSchema.parse(await apiGetUserById(id)),

    create: async (dto: UserCreate) =>
        userPublicSchema.parse(await apiCreateUser(dto)),

    update: async (dto: UserUpdate) =>
        userPublicSchema.parse(await apiUpdateUser(dto)),

    delete: async (id: string) => {
        await apiDeleteUser(id);
    },
};
