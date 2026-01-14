const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function chooseRelativeUnit(milliseconds: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const absMs = Math.abs(milliseconds);

  if (absMs < 60_000) {
    return { value: Math.round(milliseconds / 1000), unit: 'second' };
  }

  if (absMs < 3_600_000) {
    return { value: Math.round(milliseconds / 60_000), unit: 'minute' };
  }

  if (absMs < 86_400_000) {
    return { value: Math.round(milliseconds / 3_600_000), unit: 'hour' };
  }

  return { value: Math.round(milliseconds / 86_400_000), unit: 'day' };
}

export function formatRelativeOrAbsolute(timestamp: number, now: number = Date.now()): string {
  const diff = timestamp - now;
  const distance = Math.abs(diff);

  if (distance <= WEEK_IN_MS) {
    const { value, unit } = chooseRelativeUnit(diff);
    return relativeFormatter.format(value, unit);
  }

  return new Date(timestamp).toLocaleString();
}

export function formatAbsolute(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
