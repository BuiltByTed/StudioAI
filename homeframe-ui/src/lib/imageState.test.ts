import { describe, it, expect } from 'vitest';
import { normalizeImageWorkspace } from './imageState';
describe('persisted image workspace', () => {
  it('recovers safely from malformed storage and rejects unsafe URLs', () => {
    expect(
      normalizeImageWorkspace({
        prompt: [],
        size: 'broken',
        source: 'javascript:alert(1)',
        images: {},
      }),
    ).toEqual({ prompt: '', size: '1024x1024', source: '', images: [] });
    expect(
      normalizeImageWorkspace({
        images: [
          null,
          { url: 'javascript:alert(1)' },
          { url: '/cache/images/cup.png', prompt: 'green cup' },
        ],
      }).images,
    ).toEqual([{ url: '/cache/images/cup.png', prompt: 'green cup' }]);
  });
  it('restores prompt, reference and bounded gallery', () => {
    const saved = {
      prompt: 'Red cup',
      size: '512x512',
      source: 'data:image/png;base64,AA==',
      images: Array.from({ length: 101 }, (_, i) => ({ url: `/cache/${i}.png`, prompt: 'cup' })),
    };
    expect(normalizeImageWorkspace(saved)).toMatchObject({
      prompt: 'Red cup',
      size: '512x512',
      source: saved.source,
    });
    expect(normalizeImageWorkspace(saved).images).toHaveLength(100);
  });
});
