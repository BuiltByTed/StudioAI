import { it, expect } from 'vitest';
import { decodeJSON } from './api';
it('decodes the backend conversation export NDJSON contract for JSON download/import', async () => {
  const response = new Response(
    '{"id":"one","chat":{"title":"First"}}\n{"id":"two","chat":{"title":"Second"}}\n',
    { headers: { 'Content-Type': 'application/x-ndjson' } },
  );
  expect(await decodeJSON(response)).toEqual([
    { id: 'one', chat: { title: 'First' } },
    { id: 'two', chat: { title: 'Second' } },
  ]);
  expect(
    await decodeJSON(new Response('', { headers: { 'Content-Type': 'application/x-ndjson' } })),
  ).toEqual([]);
});
