import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react';
import { useHomeframeUpdate } from '@builtbyted/homeframe';
import { readJSON, writeJSON } from './storage';
import { normalizeImageWorkspace } from './imageState';
interface ImageState {
  prompt: string;
  size: string;
  source: string;
  images: { url: string; prompt: string }[];
}
interface ImageWorkspace {
  state: ImageState;
  setState: Dispatch<SetStateAction<ImageState>>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  storageError: string;
}
const Context = createContext<ImageWorkspace | null>(null);
export function ImageWorkspaceProvider({
  account,
  children,
}: {
  account: string;
  children: ReactNode;
}) {
  const key = `studio:images:${account}`;
  const [state, setState] = useState<ImageState>(() =>
    normalizeImageWorkspace(readJSON<unknown>(key, null)),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [storageError, setStorageError] = useState('');
  const update = useHomeframeUpdate();
  useEffect(() => update.registerGuard(() => !busy), [busy, update.registerGuard]);
  useEffect(() => {
    setStorageError(
      writeJSON(key, { ...state, images: state.images.slice(0, 100) })
        ? ''
        : 'Browser storage is full. Keep this tab open to retain your image workspace.',
    );
  }, [key, state]);
  return (
    <Context.Provider value={{ state, setState, busy, setBusy, error, setError, storageError }}>
      {children}
    </Context.Provider>
  );
}
export function useImageWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing image workspace');
  return value;
}
