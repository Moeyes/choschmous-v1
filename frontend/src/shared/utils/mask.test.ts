import { describe, it, expect } from 'vitest';
import { maskPhone } from './maskPhone';
import { maskNationalId } from './maskNationalId';

describe('maskPhone', () => {
    it('reveals only the last 3 digits behind a fixed prefix', () => {
        expect(maskPhone('012345678')).toBe('*** *** 678');
    });

    it('strips non-digits before masking', () => {
        expect(maskPhone('012-345-678')).toBe('*** *** 678');
    });

    it('does not leak the real length', () => {
        expect(maskPhone('0112223334445')).toBe('*** *** 445');
    });

    it('fully masks values too short to reveal safely', () => {
        expect(maskPhone('12')).toBe('***');
        expect(maskPhone('')).toBe('***');
    });
});

describe('maskNationalId', () => {
    it('reveals only the last 4 characters', () => {
        expect(maskNationalId('010203040506')).toBe('**** **** 0506');
    });

    it('fully masks short or empty values', () => {
        expect(maskNationalId('AB12')).toBe('***');
        expect(maskNationalId('')).toBe('***');
    });
});
