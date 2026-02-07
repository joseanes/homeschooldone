import { createUTCDateFromString, getStartOfDayUTC, getEndOfDayUTC, formatDateToString } from './dateUtils';

describe('dateUtils', () => {
  describe('createUTCDateFromString', () => {
    it('should create consistent UTC dates regardless of local timezone', () => {
      const dateString = '2024-01-15';
      const date = createUTCDateFromString(dateString);
      
      expect(date.toISOString()).toBe('2024-01-15T00:00:00.000Z');
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January is 0
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(0);
    });
  });

  describe('getStartOfDayUTC', () => {
    it('should set time to start of day in UTC', () => {
      const date = new Date('2024-01-15T14:30:45.123Z');
      const startOfDay = getStartOfDayUTC(date);
      
      expect(startOfDay.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });
  });

  describe('getEndOfDayUTC', () => {
    it('should set time to end of day in UTC', () => {
      const date = new Date('2024-01-15T14:30:45.123Z');
      const endOfDay = getEndOfDayUTC(date);
      
      expect(endOfDay.toISOString()).toBe('2024-01-15T23:59:59.999Z');
    });
  });

  describe('formatDateToString', () => {
    it('should format date to YYYY-MM-DD string', () => {
      const date = new Date('2024-01-15T14:30:45.123Z');
      expect(formatDateToString(date)).toBe('2024-01-15');
    });

    it('should handle dates near timezone boundaries', () => {
      // This is 11 PM on Jan 14 in EST but Jan 15 in UTC
      const date = new Date('2024-01-15T04:00:00.000Z');
      expect(formatDateToString(date)).toBe('2024-01-15');
    });

    it('should handle Firestore Timestamp objects', () => {
      const mockTimestamp = {
        toDate: () => new Date('2024-01-15T00:00:00.000Z')
      };
      expect(formatDateToString(mockTimestamp)).toBe('2024-01-15');
    });
  });
});