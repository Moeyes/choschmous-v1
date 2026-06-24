/**
 * adapters/index.ts — search module wiring point.
 * Change this one import to swap ALL data behaviour (HTTP ↔ mock).
 */
import { searchHttpAdapter } from './searchHttpAdapter';

export const searchRepository = searchHttpAdapter;
