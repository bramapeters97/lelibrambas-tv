import { describe, expect, it } from 'vitest';
import { nextFocusId } from './index';

const current = { id: 'a', left: 0, top: 0, width: 100, height: 100 };

describe('nextFocusId', () => {
  it('uses visual geometry and stays inside bounds', () => {
    expect(
      nextFocusId(
        current,
        [
          { id: 'right', left: 130, top: 0, width: 100, height: 100 },
          { id: 'diagonal', left: 110, top: 400, width: 100, height: 100 },
        ],
        'right',
      ),
    ).toBe('right');
    expect(nextFocusId(current, [], 'left')).toBeNull();
  });
});
