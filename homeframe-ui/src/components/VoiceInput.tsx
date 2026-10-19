import { useEffect, useRef, useState } from 'react';
import { useHomeframeUpdate } from '@builtbyted/homeframe';
import { Mic, Square } from 'lucide-react';
import { request, errorMessage } from '../lib/api';
import { text } from '../lib/types';

export function VoiceInput({
  append,
  onError,
}: {
  append: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(append);
  callback.current = append;
  const update = useHomeframeUpdate();
  useEffect(
    () => update.registerGuard(() => !recording && !busy),
    [recording, busy, update.registerGuard],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      controller.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const start = async () => {
    setBusy(true);
    onError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw new Error(
          'Microphone recording requires a supported browser over HTTPS. You can also use your keyboard’s dictation.',
        );
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = input;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const capture = new MediaRecorder(input, mimeType ? { mimeType } : {});
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      capture.onerror = () => {
        onError('Recording failed. Please try again.');
        input.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setBusy(false);
      };
      capture.onstop = () => {
        clearTimeout(timer.current);
        input.getTracks().forEach((track) => track.stop());
        if (!mounted.current) return;
        setRecording(false);
        setBusy(true);
        const abort = new AbortController();
        controller.current = abort;
        const blob = new Blob(chunks, { type: capture.mimeType });
        const form = new FormData();
        form.set(
          'file',
          blob,
          capture.mimeType.includes('mp4') ? 'recording.mp4' : 'recording.webm',
        );
        void (async () => {
          if (!blob.size) throw new Error('No audio was recorded.');
          const result = await (
            await request('/api/v1/audio/transcriptions', {
              method: 'POST',
              body: form,
              signal: abort.signal,
            })
          ).json();
          if (mounted.current && !abort.signal.aborted) callback.current(text(result.text));
        })()
          .catch((reason) => {
            if (mounted.current && !abort.signal.aborted) onError(errorMessage(reason));
          })
          .finally(() => {
            if (mounted.current) setBusy(false);
          });
      };
      capture.start();
      setRecording(true);
      setBusy(false);
      timer.current = setTimeout(() => {
        if (capture.state === 'recording') capture.stop();
      }, 120000);
    } catch (reason) {
      stream.current?.getTracks().forEach((track) => track.stop());
      if (mounted.current) {
        setBusy(false);
        onError(errorMessage(reason));
      }
    }
  };
  return (
    <button
      type="button"
      className={`icon-button ${recording ? 'selected' : ''}`}
      aria-label={recording ? 'Finish recording' : busy ? 'Transcribing audio' : 'Dictate message'}
      disabled={busy}
      aria-pressed={recording}
      onClick={() => (recording ? recorder.current?.stop() : void start())}
    >
      {recording ? <Square size={18} /> : <Mic size={18} />}
    </button>
  );
}
