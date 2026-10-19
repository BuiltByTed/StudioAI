import { it, expect } from 'vitest';
import { consumeCompletion } from './stream';
it('reassembles split UTF-8 SSE records and ignores heartbeat comments', async () => {
  const bytes = new TextEncoder().encode(
    ': heartbeat\r\ndata: {"choices":[{"delta":{"content":"café 🫖"}}]}\r\n\r\ndata: [DONE]\n\n',
  );
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  let result = '';
  await consumeCompletion(new Response(stream), (text) => (result += text));
  expect(result).toBe('café 🫖');
});
it('surfaces model errors instead of marking an empty stream successful', async () => {
  await expect(
    consumeCompletion(
      new Response('data: {"error":{"message":"Model unavailable"}}\n\n'),
      () => {},
    ),
  ).rejects.toThrow('Model unavailable');
});
