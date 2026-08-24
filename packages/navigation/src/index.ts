export type Direction = 'up' | 'down' | 'left' | 'right';

export interface FocusRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function centre(rect: FocusRect): [number, number] {
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

export function nextFocusId(
  current: FocusRect,
  candidates: FocusRect[],
  direction: Direction,
): string | null {
  const [cx, cy] = centre(current);
  const directional = candidates.filter((candidate) => {
    const [x, y] = centre(candidate);
    if (direction === 'left') return x < cx - 2;
    if (direction === 'right') return x > cx + 2;
    if (direction === 'up') return y < cy - 2;
    return y > cy + 2;
  });

  const ranked = directional
    .map((candidate) => {
      const [x, y] = centre(candidate);
      const primary =
        direction === 'left' || direction === 'right' ? Math.abs(x - cx) : Math.abs(y - cy);
      const secondary =
        direction === 'left' || direction === 'right' ? Math.abs(y - cy) : Math.abs(x - cx);
      return { id: candidate.id, score: primary + secondary * 2.35 };
    })
    .sort((a, b) => a.score - b.score);
  return ranked[0]?.id ?? null;
}

export function installSpatialNavigation(root: HTMLElement, onBack: () => void): () => void {
  const handler = (event: KeyboardEvent) => {
    const keyToDirection: Record<string, Direction | undefined> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const direction = keyToDirection[event.key];
    if (direction) {
      const focusables = [
        ...root.querySelectorAll<HTMLElement>('[data-focusable]:not([disabled])'),
      ].filter((element) => element.offsetParent !== null);
      const active =
        document.activeElement instanceof HTMLElement && focusables.includes(document.activeElement)
          ? document.activeElement
          : focusables[0];
      if (!active) return;
      if (document.activeElement !== active) {
        active.focus();
        event.preventDefault();
        return;
      }
      const rect = active.getBoundingClientRect();
      const current: FocusRect = {
        id: active.dataset.focusId ?? 'active',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
      const map = new Map<string, HTMLElement>();
      const candidates = focusables
        .filter((item) => item !== active)
        .map((item, index) => {
          const itemRect = item.getBoundingClientRect();
          const id = item.dataset.focusId ?? `focus-${index}`;
          map.set(id, item);
          return {
            id,
            left: itemRect.left,
            top: itemRect.top,
            width: itemRect.width,
            height: itemRect.height,
          };
        });
      const targetId = nextFocusId(current, candidates, direction);
      const target = targetId ? map.get(targetId) : undefined;
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
      event.preventDefault();
    } else if (event.key === 'Escape' || event.key === 'Backspace') {
      if ((event.target as HTMLElement).tagName !== 'INPUT') {
        event.preventDefault();
        onBack();
      }
    }
  };
  root.addEventListener('keydown', handler);
  return () => root.removeEventListener('keydown', handler);
}
