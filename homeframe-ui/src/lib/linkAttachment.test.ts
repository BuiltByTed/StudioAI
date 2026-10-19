import { expect, it } from 'vitest';
import { linkAttachment } from './linkAttachment';

it('adapts web and video responses to the full-context shape consumed by retrieval', () => {
  for (const type of ['web', 'youtube']) {
    const result = linkAttachment(
      { type, content: 'The page contents.', name: 'Page' },
      'https://example.test',
    );
    expect(result).toMatchObject({
      type: 'text',
      context: 'full',
      file: { data: { content: 'The page contents.' }, meta: { source: 'https://example.test' } },
    });
  }
  expect(() => linkAttachment({ type: 'web' }, 'https://example.test')).toThrow('readable content');
});

it('uses authenticated file content URLs for downloaded files and images', () => {
  expect(
    linkAttachment({ type: 'image', file: { id: 'image/id' } }, 'https://example.test/photo.png'),
  ).toMatchObject({ id: 'image/id', type: 'image', url: '/api/v1/files/image%2Fid/content' });
});
