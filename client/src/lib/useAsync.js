'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Runs an async function on mount / when deps change. reload() refetches without flashing the spinner.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const counter = useRef(0);

  const run = useCallback(async (silent) => {
    const id = ++counter.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === counter.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === counter.current) setState((s) => ({ data: s.data, loading: false, error }));
    }
  }, []);

  useEffect(() => { run(false); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: () => run(true) };
}
