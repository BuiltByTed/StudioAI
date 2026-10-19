import { useEffect, useState } from 'react';
import { HomeframeTextarea, useHomeframeUpdate } from '@builtbyted/homeframe';
import { useChat } from '../lib/chat';
import { useSession } from '../lib/session';
import { object, text, type Dict } from '../lib/types';
import { Action, Field, JSONField } from './ui';

export function ChatParameters() {
  const chat = useChat(),
    { settings } = useSession(),
    update = useHomeframeUpdate();
  const [draft, setDraft] = useState<Dict>({}),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    setDraft({ ...object(object(settings.ui).params), ...chat.chat?.chat.params });
    setDirty(false);
  }, [chat.chat?.id, chat.chat?.chat.params, settings]);
  useEffect(() => update.registerGuard(() => !dirty), [dirty, update.registerGuard]);
  return (
    <details className="stack" data-validation-scope>
      <summary>Conversation settings</summary>
      <Field label="Conversation instructions">
        <HomeframeTextarea
          rows={3}
          value={text(draft.system)}
          onChange={(e) => {
            setDraft({ ...draft, system: e.target.value });
            setDirty(true);
          }}
        />
      </Field>
      <details>
        <summary>Advanced generation parameters</summary>
        <JSONField
          label="Conversation parameters"
          value={draft}
          onChange={(value) => {
            setDraft(object(value));
            setDirty(true);
          }}
        />
      </details>
      <Action
        disabled={!dirty || chat.busy || chat.loading}
        run={async () => {
          await chat.updateChat({ params: draft });
          setDirty(false);
        }}
      >
        Apply conversation settings
      </Action>
    </details>
  );
}
