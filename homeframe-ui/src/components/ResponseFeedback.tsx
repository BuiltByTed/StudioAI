import { useState } from 'react';
import { HomeframeTextarea } from '@builtbyted/homeframe';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useChat } from '../lib/chat';
import { useSession } from '../lib/session';
import { api, segment } from '../lib/api';
import { object, text, type Message, type Dict } from '../lib/types';
import { Action, Field } from './ui';
export function ResponseFeedback({ message }: { message: Message }) {
  const state = useChat(),
    { config, user } = useSession();
  const [comment, setComment] = useState(text(object(message.annotation).comment)),
    [expanded, setExpanded] = useState(false);
  if (
    state.temporary ||
    !state.chat?.id ||
    config.features?.enable_message_rating === false ||
    (user?.role !== 'admin' && user?.permissions?.chat?.rate_response === false)
  )
    return null;
  const rating = object(message.annotation).rating;
  const save = async (next: number) => {
    if (!state.chat || state.busy) return;
    const annotation = { ...object(message.annotation), rating: next, comment };
    const feedback = await api<Dict>(
      message.feedbackId
        ? `/api/v1/evaluations/feedback/${segment(text(message.feedbackId))}`
        : '/api/v1/evaluations/feedback',
      {
        type: 'rating',
        data: { ...annotation, model_id: message.model },
        meta: { chat_id: state.chat.id, message_id: message.id, model_id: message.model },
        snapshot: { chat: state.chat },
      },
    );
    await state.updateChat({
      history: {
        ...state.chat.chat.history,
        messages: {
          ...state.chat.chat.history.messages,
          [message.id]: { ...message, annotation, feedbackId: feedback.id },
        },
      },
    });
  };
  return (
    <div className="feedback-actions">
      <Action
        disabled={state.busy}
        aria-label="Helpful response"
        aria-pressed={rating === 1}
        run={async () => {
          await save(1);
          setExpanded(true);
        }}
      >
        <ThumbsUp size={15} />
      </Action>
      <Action
        disabled={state.busy}
        aria-label="Unhelpful response"
        aria-pressed={rating === -1}
        run={async () => {
          await save(-1);
          setExpanded(true);
        }}
      >
        <ThumbsDown size={15} />
      </Action>
      {expanded && (
        <div className="stack">
          <Field label="Response feedback">
            <HomeframeTextarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <Action
            disabled={state.busy}
            run={async () => {
              await save(rating === -1 ? -1 : 1);
              setExpanded(false);
            }}
          >
            Save feedback
          </Action>
        </div>
      )}
    </div>
  );
}
