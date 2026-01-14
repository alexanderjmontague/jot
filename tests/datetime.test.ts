import { describe, it, expect } from 'vitest';
import { formatRelativeOrAbsolute, formatAbsolute } from '../src/shared/datetime';

describe('formatRelativeOrAbsolute', () => {
  const NOW = new Date('2025-01-13T12:00:00Z').getTime();

  it('formats seconds ago', () => {
    const thirtySecondsAgo = NOW - 30 * 1000;
    const result = formatRelativeOrAbsolute(thirtySecondsAgo, NOW);
    expect(result).toMatch(/30 seconds ago|30 secs ago/i);
  });

  it('formats minutes ago', () => {
    const fiveMinutesAgo = NOW - 5 * 60 * 1000;
    const result = formatRelativeOrAbsolute(fiveMinutesAgo, NOW);
    expect(result).toMatch(/5 minutes ago|5 mins ago/i);
  });

  it('formats hours ago', () => {
    const threeHoursAgo = NOW - 3 * 60 * 60 * 1000;
    const result = formatRelativeOrAbsolute(threeHoursAgo, NOW);
    expect(result).toMatch(/3 hours ago|3 hrs ago/i);
  });

  it('formats days ago', () => {
    const twoDaysAgo = NOW - 2 * 24 * 60 * 60 * 1000;
    const result = formatRelativeOrAbsolute(twoDaysAgo, NOW);
    expect(result).toMatch(/2 days ago/i);
  });

  it('uses absolute format beyond a week', () => {
    const twoWeeksAgo = NOW - 14 * 24 * 60 * 60 * 1000;
    const result = formatRelativeOrAbsolute(twoWeeksAgo, NOW);
    // Should be a locale date string, not relative
    expect(result).not.toMatch(/ago/i);
    expect(result).toMatch(/\d/); // Contains numbers (date)
  });

  it('handles future times', () => {
    const inFiveMinutes = NOW + 5 * 60 * 1000;
    const result = formatRelativeOrAbsolute(inFiveMinutes, NOW);
    expect(result).toMatch(/in 5 minutes|in 5 mins/i);
  });
});

describe('formatAbsolute', () => {
  it('returns a locale date string', () => {
    const timestamp = new Date('2025-01-13T12:00:00Z').getTime();
    const result = formatAbsolute(timestamp);
    // Should contain date components
    expect(result).toMatch(/\d/);
    expect(result.length).toBeGreaterThan(0);
  });
});
