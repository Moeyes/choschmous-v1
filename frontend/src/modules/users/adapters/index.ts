/**
 * adapters/index.ts — users module wiring point.
 * Change this one import to swap ALL data behaviour (HTTP ↔ mock).
 * Mock adapters must use synthetic data only — never real user records.
 */
import { usersHttpAdapter } from './usersHttpAdapter';
// import { usersMockAdapter } from './usersMockAdapter'; // ← swap for tests

export const usersRepository = usersHttpAdapter;
