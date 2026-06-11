/**
 * adapters/index.ts — organizations module wiring point.
 * Change this one import to swap ALL data behaviour (HTTP ↔ mock).
 */
import { organizationsHttpAdapter } from './organizationsHttpAdapter';
// import { organizationsMockAdapter } from './organizationsMockAdapter'; // ← swap for tests

export const organizationsRepository = organizationsHttpAdapter;
