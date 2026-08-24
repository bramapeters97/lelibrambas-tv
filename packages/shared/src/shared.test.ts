import { describe, expect, it } from 'vitest';
import {
  canResume,
  clampSeek,
  createPairingCode,
  isExpired,
  progressKey,
  shouldMarkComplete,
  tokenNeedsRefresh,
} from './index';

describe('progressKey', () => {
  it('isolates video progress per profile', () => {
    expect(progressKey('family', 'film-1')).toBe('progress:family:film-1');
    expect(progressKey('guest', 'film-1')).not.toBe(progressKey('family', 'film-1'));
  });
});

describe('player state', () => {
  it('clamps ten-second seek without leaving the timeline', () => {
    expect(clampSeek(4, -10, 100)).toBe(0);
    expect(clampSeek(96, 10, 100)).toBe(100);
  });

  it('marks complete near the end and suppresses stale resume', () => {
    expect(shouldMarkComplete(95, 100)).toBe(true);
    expect(canResume(50, 100)).toBe(true);
    expect(canResume(95, 100)).toBe(false);
  });
});

describe('private device lifecycle', () => {
  it('creates deterministic six-character codes without ambiguous glyphs', () => {
    expect(createPairingCode(2026)).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(createPairingCode(2026)).toBe(createPairingCode(2026));
  });

  it('handles expired pairing codes and expiring playback tokens', () => {
    const now = new Date('2026-08-17T12:00:00.000Z');
    expect(isExpired('2026-08-17T11:59:59.000Z', now)).toBe(true);
    expect(tokenNeedsRefresh('2026-08-17T12:00:30.000Z', now)).toBe(true);
    expect(tokenNeedsRefresh('2026-08-17T12:05:00.000Z', now)).toBe(false);
  });
});
