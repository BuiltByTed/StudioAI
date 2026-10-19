import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { useSession } from '../lib/session';
import { object, text } from '../lib/types';
import { errorMessage, request } from '../lib/api';
export function ReadAloud({
  content,
  onError,
}: {
  content: string;
  onError: (message: string) => void;
}) {
  const { config } = useSession();
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null),
    source = useRef('');
  const controller = useRef<AbortController | null>(null),
    speech = useRef<SpeechSynthesisUtterance | null>(null);
  const stop = () => {
    controller.current?.abort();
    audio.current?.pause();
    audio.current = null;
    if (source.current) URL.revokeObjectURL(source.current);
    source.current = '';
    if (speech.current) window.speechSynthesis?.cancel();
    speech.current = null;
    setPlaying(false);
  };
  useEffect(() => stop, []);
  return (
    <button
      aria-label={playing ? 'Stop reading' : 'Read aloud'}
      onClick={() => {
        if (playing) {
          stop();
          return;
        }
        setPlaying(true);
        onError('');
        const tts = object(object(config.audio).tts);
        if (!text(tts.engine) || tts.engine === 'browser') {
          if (!window.speechSynthesis) {
            setPlaying(false);
            onError('Speech playback is unavailable in this browser.');
            return;
          }
          const utterance = new SpeechSynthesisUtterance(content);
          speech.current = utterance;
          utterance.onend = () => setPlaying(false);
          utterance.onerror = () => setPlaying(false);
          window.speechSynthesis.speak(utterance);
          return;
        }
        const abort = new AbortController();
        controller.current = abort;
        void request('/api/v1/audio/speech', {
          method: 'POST',
          body: JSON.stringify({ input: content, voice: text(tts.voice) || 'alloy' }),
          signal: abort.signal,
        })
          .then((response) => response.blob())
          .then(async (blob) => {
            if (abort.signal.aborted) return;
            source.current = URL.createObjectURL(blob);
            const player = new Audio(source.current);
            audio.current = player;
            player.onended = stop;
            player.onerror = () => {
              stop();
              onError('Speech audio could not be played.');
            };
            await player.play();
          })
          .catch((reason) => {
            if (!abort.signal.aborted) {
              stop();
              onError(errorMessage(reason));
            }
          });
      }}
    >
      {playing ? <Square size={15} /> : <Volume2 size={15} />}
    </button>
  );
}
