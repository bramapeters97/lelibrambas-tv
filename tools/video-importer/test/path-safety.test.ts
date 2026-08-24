import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertOutputOutsideSource, sanitizeOutputStem } from '../src/index.js';

describe('path safety', () => {
  it('refuses output in the source archive', () => {
    const source = path.resolve('D:/Family Videos');
    expect(() => assertOutputOutsideSource(source, path.join(source, 'converted'))).toThrow(
      /Refusing/u,
    );
  });

  it('creates Windows-safe output stems', () => {
    expect(sanitizeOutputStem('CON')).toBe('untitled-video');
    expect(sanitizeOutputStem('A: trip?  ')).toBe('A trip');
  });
});
