import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for data fetching with loading / error / retry states.
 * 
 * @param {Function} fetchFn  - async function that returns data
 * @param {Array} deps        - dependency array (re-fetches when these change)
 * @param {object} opts       - { immediate: true } to auto-fetch on mount
 */
export function useApi(fetchFn, deps = [], opts = { immediate: true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(opts.immediate !== false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(...args);
      if (mountedRef.current) setData(result);
      return result;
    } catch (err) {
      if (mountedRef.current) setError(err.message || String(err));
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    if (opts.immediate !== false) execute();
    return () => { mountedRef.current = false; };
  }, [execute]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, execute, setData };
}
