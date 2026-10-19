import { useEffect, useRef, useState } from 'react';
import { HomeframeInput, useHomeframeUpdate, useRouterSnapshot } from '@builtbyted/homeframe';
import { api } from '../lib/api';
import { object, text, type Attachment, type Dict } from '../lib/types';
import { linkAttachment } from '../lib/linkAttachment';
import { Action, Field } from './ui';

export function LinkContext({ attach }: { attach: (file: Attachment) => void }) {
  const route = useRouterSnapshot(),
    update = useHomeframeUpdate();
  const youtube = route.url.searchParams.get('youtube');
  const initial =
    route.url.searchParams.get('load-url') ||
    (youtube ? `https://www.youtube.com/watch?v=${encodeURIComponent(youtube)}` : '');
  const [url, setUrl] = useState(initial),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => setUrl(initial), [initial]);
  useEffect(() => update.registerGuard(() => !busy), [busy, update.registerGuard]);
  return (
    <div className="stack" data-validation-scope>
      <Field label="Web page or video URL">
        <HomeframeInput
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Action
        disabled={!url.trim() || busy}
        run={async () => {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol))
            throw new Error('Use an HTTP or HTTPS link.');
          setBusy(true);
          const abort = new AbortController();
          controller.current = abort;
          try {
            const result = await api<Dict>(
              '/api/v1/retrieval/process/url?process=false',
              { url: parsed.href },
              { signal: abort.signal },
            );
            if (abort.signal.aborted) return;
            const fileId = text(object(result.file).id);
            if (result.type === 'file' && fileId) {
              await api(
                '/api/v1/retrieval/process/file',
                { file_id: fileId },
                { signal: abort.signal },
              );
              result.file = await api(`/api/v1/files/${encodeURIComponent(fileId)}`, undefined, {
                signal: abort.signal,
              });
            }
            if (abort.signal.aborted) return;
            attach(linkAttachment(result, parsed.href));
            setUrl('');
          } catch (reason) {
            if (!abort.signal.aborted) throw reason;
          } finally {
            if (!abort.signal.aborted) setBusy(false);
          }
        }}
      >
        Attach link content
      </Action>
    </div>
  );
}
