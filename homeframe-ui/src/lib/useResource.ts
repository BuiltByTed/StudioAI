import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';

export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState('');
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const version = ++generation.current;
    const abort = new AbortController();
    setData(null);
    setError('');
    setLoading(Boolean(path));
    if (path)
      api<T>(path, undefined, { signal: abort.signal })
        .then((value) => {
          if (version === generation.current) setData(value);
        })
        .catch((reason) => {
          if (!abort.signal.aborted && version === generation.current)
            setError(errorMessage(reason));
        })
        .finally(() => {
          if (version === generation.current) setLoading(false);
        });
    return () => {
      abort.abort();
      generation.current++;
    };
  }, [path, revision]);
  return { data, setData, loading, error, reload };
}
