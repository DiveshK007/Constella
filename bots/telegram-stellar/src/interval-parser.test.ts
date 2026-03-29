/**
 * StellrFlow — interval-parser.ts Unit Tests
 * ===========================================
 * Full coverage of parseIntervalFormat, formatIntervalForDisplay,
 * and isValidIntervalFormat.
 *
 * Pure logic — no mocking required.
 */

import {
  parseIntervalFormat,
  formatIntervalForDisplay,
  isValidIntervalFormat,
} from './interval-parser';

// ─────────────────────────────────────────────────────────────────────────

describe('parseIntervalFormat()', () => {

  describe('raw millisecond strings (all digits)', () => {
    it('parses "0" as 0ms', () => {
      expect(parseIntervalFormat('0')).toBe(0);
    });
    it('parses "5000" as 5000ms', () => {
      expect(parseIntervalFormat('5000')).toBe(5000);
    });
    it('parses "86400000" (1 day in ms)', () => {
      expect(parseIntervalFormat('86400000')).toBe(86_400_000);
    });
  });

  describe('seconds — "s", "sec", "second", "seconds"', () => {
    it('"1s" → 1000ms', () => expect(parseIntervalFormat('1s')).toBe(1_000));
    it('"30s" → 30000ms', () => expect(parseIntervalFormat('30s')).toBe(30_000));
    it('"3600s" → 3600000ms', () => expect(parseIntervalFormat('3600s')).toBe(3_600_000));
    it('"10sec" is accepted', () => expect(parseIntervalFormat('10sec')).toBe(10_000));
    it('"60seconds" is accepted', () => expect(parseIntervalFormat('60seconds')).toBe(60_000));
  });

  describe('minutes — "m", "min", "minutes"', () => {
    it('"1m" → 60000ms', () => expect(parseIntervalFormat('1m')).toBe(60_000));
    it('"30m" → 1800000ms', () => expect(parseIntervalFormat('30m')).toBe(1_800_000));
    it('"60min" → 3600000ms', () => expect(parseIntervalFormat('60min')).toBe(3_600_000));
    it('"5minutes" is accepted', () => expect(parseIntervalFormat('5minutes')).toBe(300_000));
  });

  describe('hours — "h", "hr", "hour", "hours"', () => {
    it('"1h" → 3600000ms', () => expect(parseIntervalFormat('1h')).toBe(3_600_000));
    it('"24h" → 86400000ms', () => expect(parseIntervalFormat('24h')).toBe(86_400_000));
    it('"1hr" is accepted', () => expect(parseIntervalFormat('1hr')).toBe(3_600_000));
    it('"2hours" is accepted', () => expect(parseIntervalFormat('2hours')).toBe(7_200_000));
  });

  describe('days — "d", "day", "days"', () => {
    it('"1d" → 86400000ms', () => expect(parseIntervalFormat('1d')).toBe(86_400_000));
    it('"7d" → 604800000ms', () => expect(parseIntervalFormat('7d')).toBe(604_800_000));
    it('"1day" is accepted', () => expect(parseIntervalFormat('1day')).toBe(86_400_000));
    it('"30days" is accepted', () => expect(parseIntervalFormat('30days')).toBe(2_592_000_000));
  });

  describe('weeks — "w", "week", "weeks"', () => {
    it('"1w" → 604800000ms', () => expect(parseIntervalFormat('1w')).toBe(604_800_000));
    it('"2w" → 1209600000ms', () => expect(parseIntervalFormat('2w')).toBe(1_209_600_000));
    it('"1week" is accepted', () => expect(parseIntervalFormat('1week')).toBe(604_800_000));
    it('"4weeks" is accepted', () => expect(parseIntervalFormat('4weeks')).toBe(2_419_200_000));
  });

  describe('edge cases', () => {
    it('trims surrounding whitespace', () => {
      expect(parseIntervalFormat('  10s  ')).toBe(10_000);
    });
    it('handles decimal values like "1.5h"', () => {
      expect(parseIntervalFormat('1.5h')).toBe(5_400_000);
    });
    it('throws on invalid format (letters only)', () => {
      expect(() => parseIntervalFormat('invalid')).toThrow('Invalid interval format');
    });
    it('throws on unknown unit', () => {
      expect(() => parseIntervalFormat('10x')).toThrow('Unknown time unit');
    });
    it('throws on empty string', () => {
      expect(() => parseIntervalFormat('')).toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('formatIntervalForDisplay()', () => {

  it('formats < 60s as seconds: 30000ms → "30s"', () => {
    expect(formatIntervalForDisplay(30_000)).toBe('30s');
  });

  it('formats < 1h as minutes: 1800000ms → "30m"', () => {
    expect(formatIntervalForDisplay(1_800_000)).toBe('30m');
  });

  it('formats < 1d as hours: 3600000ms → "1h"', () => {
    expect(formatIntervalForDisplay(3_600_000)).toBe('1h');
  });

  it('formats < 1w as days: 86400000ms → "1d"', () => {
    expect(formatIntervalForDisplay(86_400_000)).toBe('1d');
  });

  it('formats ≥ 1w as weeks: 604800000ms → "1w"', () => {
    expect(formatIntervalForDisplay(604_800_000)).toBe('1w');
  });

  it('round-trips: parseIntervalFormat then formatIntervalForDisplay', () => {
    const cases = ['30s', '5m', '2h', '3d', '1w'];
    cases.forEach(input => {
      const ms = parseIntervalFormat(input);
      const display = formatIntervalForDisplay(ms);
      // Re-parse must give same ms value
      expect(parseIntervalFormat(display)).toBe(ms);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('isValidIntervalFormat()', () => {
  it('returns true for valid formats', () => {
    ['1s', '30m', '2h', '7d', '1w', '3600s', '5000'].forEach(v => {
      expect(isValidIntervalFormat(v)).toBe(true);
    });
  });

  it('returns false for invalid formats', () => {
    ['abc', '', '10xyz', '!!'].forEach(v => {
      expect(isValidIntervalFormat(v)).toBe(false);
    });
  });
});
