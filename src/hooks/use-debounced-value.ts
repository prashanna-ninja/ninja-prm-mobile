import { useEffect, useState } from "react";

/**
 * Delay a fast-changing value (a search box) so it doesn't drive a query on
 * every keystroke. 300ms is the sweet spot — fast enough to feel live, slow
 * enough that a typed word is one request.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
