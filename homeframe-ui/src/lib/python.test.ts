import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  workers: [] as {
    posted: { id: string }[];
    terminated: boolean;
    respond: (value: unknown) => void;
  }[],
}));
vi.mock('./upstream/pyodideSandboxHost', () => ({
  PyodideSandboxHost: class extends EventTarget {
    posted: { id: string }[] = [];
    terminated = false;
    constructor() {
      super();
      state.workers.push(this);
    }
    postMessage(data: { id: string }) {
      this.posted.push(data);
    }
    respond(value: unknown) {
      this.dispatchEvent(new MessageEvent('message', { data: value }));
    }
    terminate() {
      this.terminated = true;
    }
  },
}));
import { disposePython, executePython } from './python';
afterEach(() => {
  disposePython();
  state.workers.length = 0;
});
describe('Python execution session isolation', () => {
  it('cancels active and queued work on logout and lets the new session proceed', async () => {
    const first = executePython({ id: 'old-active', code: 'print(1)' });
    const queued = executePython({ id: 'old-queued', code: 'print(2)' });
    await vi.waitFor(() => expect(state.workers[0]?.posted).toHaveLength(1));
    disposePython();
    expect((await first).stderr).toContain('session changed');
    expect((await queued).stderr).toContain('session changed');
    expect(state.workers[0]?.terminated).toBe(true);
    const next = executePython({ id: 'new-account', code: 'print(3)' });
    await vi.waitFor(() => expect(state.workers[1]?.posted[0]?.id).toBe('new-account'));
    state.workers[1]!.respond({ id: 'new-account', stdout: '3\n' });
    expect(await next).toEqual({ stdout: '3\n', stderr: null, result: null });
    expect(state.workers[0]?.posted).toHaveLength(1);
  });
  it('serializes jobs and ignores unrelated worker replies', async () => {
    const first = executePython({ id: 'one', code: 'print(1)' }),
      second = executePython({ id: 'two', code: 'print(2)' });
    await vi.waitFor(() => expect(state.workers[0]?.posted).toHaveLength(1));
    const worker = state.workers[0]!;
    worker.respond({ id: 'unrelated', stdout: 'wrong' });
    expect(worker.posted).toHaveLength(1);
    worker.respond({ id: 'one', stdout: '1' });
    expect((await first).stdout).toBe('1');
    await vi.waitFor(() => expect(worker.posted).toHaveLength(2));
    worker.respond({ id: 'two', stdout: '2' });
    expect((await second).stdout).toBe('2');
  });
});
