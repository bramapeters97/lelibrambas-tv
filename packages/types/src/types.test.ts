import { describe, expect, it } from 'vitest';
import { videoRecordSchema } from './index';

describe('videoRecordSchema', () => {
  it('rejects stretched or unsupported aspect ratios', () => {
    expect(() => videoRecordSchema.parse({ aspectRatio: 'stretched' })).toThrow();
  });
});
