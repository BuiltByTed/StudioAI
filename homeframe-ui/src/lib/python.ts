// Reuse Open WebUI's isolated execution implementation, including its license.
// The sandbox has an opaque origin and cannot read application cookies/storage.
import { PyodideSandboxHost } from './upstream/pyodideSandboxHost';
import { request, segment } from './api';
import { object, text, type Dict } from './types';

let sandbox: PyodideSandboxHost | null = null;
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;
let requests = new AbortController();
const cancellations = new Set<() => void>();
export function disposePython() {
  generation++;
  requests.abort();
  requests = new AbortController();
  for (const cancel of [...cancellations]) cancel();
  sandbox?.terminate();
  sandbox = null;
  queue = Promise.resolve();
}
export function executePython(data: Dict): Promise<Dict> {
  const identity = generation;
  const signal = requests.signal;
  const work = queue
    .catch(() => undefined)
    .then(async () => {
      if (identity !== generation)
        return {
          stderr: 'Execution cancelled because the session changed.',
          stdout: null,
          result: null,
        };
      const worker = (sandbox ??= new PyodideSandboxHost());
      const id = text(data.id) || crypto.randomUUID();
      const code = text(data.code);
      const files: { name: string; data: ArrayBuffer }[] = [];
      for (const item of Array.isArray(data.files) ? data.files : []) {
        const file = object(item);
        if (!text(file.id)) continue;
        const response = await request(`/api/v1/files/${segment(text(file.id))}/content`, {
          signal,
        });
        files.push({
          name: (text(file.filename) || text(file.name) || 'file').split(/[\\/]/).at(-1)!,
          data: await response.arrayBuffer(),
        });
      }
      if (identity !== generation)
        return {
          stderr: 'Execution cancelled because the session changed.',
          stdout: null,
          result: null,
        };
      const packages = Object.entries({
        numpy: 'numpy',
        pandas: 'pandas',
        matplotlib: 'matplotlib',
        scipy: 'scipy',
        sympy: 'sympy',
        sklearn: 'scikit-learn',
        seaborn: 'seaborn',
        requests: 'requests',
        bs4: 'beautifulsoup4',
        openpyxl: 'openpyxl',
        pptx: 'python-pptx',
        docx: 'python-docx',
      })
        .filter(([name]) => new RegExp(`\\b(?:import|from)\\s+${name}\\b`).test(code))
        .map(([, name]) => name);
      return new Promise<Dict>((resolve) => {
        const cleanup = () => {
          clearTimeout(timer);
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          cancellations.delete(cancel);
        };
        const cancel = () => {
          cleanup();
          resolve({
            stderr: 'Execution cancelled because the session changed.',
            stdout: null,
            result: null,
          });
        };
        const terminate = () => {
          worker.terminate();
          if (sandbox === worker) sandbox = null;
        };
        const onMessage = (event: MessageEvent) => {
          const result = object(event.data);
          if (result.id !== id) return;
          cleanup();
          resolve({
            stdout: result.stdout ?? null,
            stderr: result.stderr ?? null,
            result: result.result ?? null,
          });
        };
        const onError = () => {
          cleanup();
          terminate();
          resolve({ stderr: 'The Python sandbox could not start.', stdout: null, result: null });
        };
        const timer = setTimeout(() => {
          cleanup();
          terminate();
          resolve({
            stderr: 'Execution time limit exceeded (60 seconds).',
            stdout: null,
            result: null,
          });
        }, 60000);
        cancellations.add(cancel);
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage({ type: 'execute', id, code, files, packages });
      });
    });
  queue = work;
  return work;
}
